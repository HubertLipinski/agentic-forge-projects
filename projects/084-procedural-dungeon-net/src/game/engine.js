/**
 * @file src/game/engine.js
 * @description The main game loop. Ticks the world state, simulates NPCs, and processes player actions at a fixed rate.
 * This module is the heart of the simulation, responsible for advancing the game state over time.
 * It orchestrates NPC behavior updates, handles pending player actions, and ensures the world
 * remains consistent and alive.
 */

import { performance } from 'node:perf_hooks';
import { NpcFSM } from '../entities/npc-fsm.js';

/**
 * The GameEngine class orchestrates the main game loop, processing updates
 * at a fixed interval (the "tick rate"). On each tick, it simulates NPC actions
 * and processes queued player commands, advancing the overall world state.
 */
export class GameEngine {
  /**
   * The rate at which the game loop runs, in milliseconds.
   * @private
   * @type {number}
   */
  #tickRate;

  /**
   * A reference to the WorldState, which holds all game data.
   * @private
   * @type {import('../state/world-state.js').WorldState}
   */
  #worldState;

  /**
   * A reference to the ActionHandler for executing player commands.
   * @private
   * @type {import('./action-handler.js').ActionHandler}
   */
  #actionHandler;

  /**
   * The handle for the `setInterval` timer that runs the game loop.
   * Null if the engine is not running.
   * @private
   * @type {NodeJS.Timeout | null}
   */
  #loopInterval = null;

  /**
   * A queue for player actions received from client sessions.
   * Actions are processed once per tick.
   * @private
   * @type {Array<{sessionId: string, action: object}>}
   */
  #actionQueue = [];

  /**
   * A map to store FSM instances for each NPC, keyed by NPC ID.
   * This keeps the simulation logic separate from the actor data model.
   * @private
   * @type {Map<string, NpcFSM>}
   */
  #npcFsmMap = new Map();

  /**
   * A flag to indicate if the engine is currently running.
   * @private
   * @type {boolean}
   */
  #isRunning = false;

  /**
   * Creates a new GameEngine instance.
   *
   * @param {object} options - The configuration for the game engine.
   * @param {import('../state/world-state.js').WorldState} options.worldState - The single source of truth for game data.
   * @param {import('./action-handler.js').ActionHandler} options.actionHandler - The handler for player actions.
   * @param {number} [options.tickRate=100] - The interval for game ticks in milliseconds.
   */
  constructor({ worldState, actionHandler, tickRate = 100 }) {
    if (!worldState) {
      throw new Error('GameEngine requires a valid WorldState instance.');
    }
    if (!actionHandler) {
      throw new Error('GameEngine requires a valid ActionHandler instance.');
    }
    if (tickRate <= 0) {
      throw new Error('tickRate must be a positive number.');
    }

    this.#worldState = worldState;
    this.#actionHandler = actionHandler;
    this.#tickRate = tickRate;
  }

  /**
   * Starts the game loop.
   * Initializes FSMs for all existing NPCs and sets up the interval timer.
   * Does nothing if the engine is already running.
   */
  start() {
    if (this.#isRunning) {
      console.warn('GameEngine is already running. Ignoring start command.');
      return;
    }

    console.log(`Starting game engine with a tick rate of ${this.#tickRate}ms.`);
    this.#isRunning = true;

    // Initialize FSMs for all NPCs currently in the world state.
    // This is crucial for when the engine starts after a state has been loaded from disk.
    this.#initializeNpcFsms();

    // Set up the main game loop using a precise timer.
    this.#loopInterval = setInterval(() => this.#tick(), this.#tickRate);

    this.#worldState.eventBus.emit('engineStarted');
  }

  /**
   * Stops the game loop.
   * Clears the interval timer and performs any necessary cleanup.
   * Does nothing if the engine is not running.
   */
  stop() {
    if (!this.#isRunning) {
      console.warn('GameEngine is not running. Ignoring stop command.');
      return;
    }

    console.log('Stopping game engine...');
    this.#isRunning = false;

    if (this.#loopInterval) {
      clearInterval(this.#loopInterval);
      this.#loopInterval = null;
    }

    // Clear any pending actions to prevent processing on next start.
    this.#actionQueue = [];
    this.#npcFsmMap.clear(); // Clear FSMs to be rebuilt on next start.

    this.#worldState.eventBus.emit('engineStopped');
    console.log('Game engine stopped.');
  }

  /**
   * Adds a player action to the queue to be processed on the next tick.
   * This decouples network input from game simulation, ensuring actions are
   * processed in a predictable, sequential order.
   *
   * @param {string} sessionId - The unique ID of the client session submitting the action.
   * @param {object} action - The parsed action object from the CommandParser.
   */
  queueAction(sessionId, action) {
    if (!this.#isRunning) {
      // Optionally, send a message back to the client that the world is paused.
      return;
    }
    this.#actionQueue.push({ sessionId, action });
  }

  /**
   * The main game loop logic, executed on each tick.
   * @private
   */
  #tick() {
    const startTime = performance.now();

    try {
      // 1. Process all queued player actions from the last tick.
      this.#processPlayerActions();

      // 2. Simulate all NPCs.
      this.#simulateNpcs();

      // 3. Perform any other periodic world updates (e.g., item decay, weather changes).
      // (Placeholder for future expansion)

    } catch (error) {
      console.error('An error occurred during a game tick:', error);
      // Depending on the severity, we might want to stop the engine.
      // For now, we log and continue, hoping it's a transient issue.
    }

    const endTime = performance.now();
    const tickDuration = endTime - startTime;

    if (tickDuration > this.#tickRate) {
      console.warn(`Tick duration (${tickDuration.toFixed(2)}ms) exceeded tick rate (${this.#tickRate}ms). Server may be overloaded.`);
    }
  }

  /**
   * Processes all actions in the action queue.
   * @private
   */
  #processPlayerActions() {
    // Process a copy of the queue and clear the original to prevent
    // race conditions and allow new actions to be queued during processing.
    const actionsToProcess = [...this.#actionQueue];
    this.#actionQueue = [];

    for (const { sessionId, action } of actionsToProcess) {
      try {
        this.#actionHandler.handle(sessionId, action);
      } catch (error) {
        console.error(`Error processing action for session ${sessionId}:`, error);
        // It's often better to notify the specific client of the error
        // rather than crashing the whole action processing loop.
        this.#worldState.eventBus.emit('actionError', { sessionId, error: error.message });
      }
    }
  }

  /**
   * Updates the state of all NPCs in the world.
   * @private
   */
  #simulateNpcs() {
    const npcs = this.#worldState.getNpcs();
    for (const npc of npcs) {
      // Ensure every NPC has an associated FSM.
      if (!this.#npcFsmMap.has(npc.id)) {
        this.#registerNpc(npc);
      }

      const fsm = this.#npcFsmMap.get(npc.id);
      try {
        // The FSM update handles all NPC logic for this tick.
        fsm.update(this.#worldState);
      } catch (error) {
        console.error(`Error simulating NPC ${npc.name} (${npc.id}):`, error);
      }
    }
  }

  /**
   * Initializes FSMs for all NPCs in the world state.
   * This is typically called once when the engine starts.
   * @private
   */
  #initializeNpcFsms() {
    this.#npcFsmMap.clear();
    const npcs = this.#worldState.getNpcs();
    console.log(`Initializing FSMs for ${npcs.length} NPCs.`);
    for (const npc of npcs) {
      this.#registerNpc(npc);
    }
  }

  /**
   * Creates and registers a new FSM for a given NPC.
   * If an FSM for the NPC already exists, this does nothing.
   * This allows for dynamic spawning of NPCs while the engine is running.
   * @param {import('../entities/actor.js').Actor} npc - The NPC to register.
   * @private
   */
  #registerNpc(npc) {
    if (this.#npcFsmMap.has(npc.id)) {
      return;
    }

    const fsm = new NpcFSM(npc);
    // If the NPC has serialized FSM data (from a loaded state), restore it.
    if (npc.fsmData) {
        fsm.deserialize(npc.fsmData);
    }
    this.#npcFsmMap.set(npc.id, fsm);
  }
}