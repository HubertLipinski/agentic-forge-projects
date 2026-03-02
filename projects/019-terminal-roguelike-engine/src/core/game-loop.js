/**
 * @file src/core/game-loop.js
 * @description The main game loop, handling player input, updating game state via ECS systems, and triggering renders.
 *
 * This file orchestrates the core turn-based flow of the roguelike. It waits for
 * player input, processes the resulting action, allows game systems (like AI and
 * physics) to update, and finally renders the new state to the terminal.
 */

import { EventEmitter } from 'node:events';

/**
 * The GameLoop class manages the turn-based execution flow of the game.
 * It integrates input handling, state updates (via ECS systems), and rendering.
 * It uses an event-driven approach to decouple from specific input/rendering implementations.
 *
 * The loop follows a classic roguelike turn structure:
 * 1. Render the current game state.
 * 2. Wait for player input.
 * 3. Process the player's action.
 * 4. Run all registered ECS systems (e.g., AI movement, combat resolution).
 * 5. Repeat.
 *
 * @extends EventEmitter
 */
export class GameLoop extends EventEmitter {
  /**
   * @private
   * @type {import('../ecs/index.js').World} The ECS world instance.
   */
  #world;

  /**
   * @private
   * @type {import('./renderer.js').Renderer} The renderer instance.
   */
  #renderer;

  /**
   * @private
   * @type {import('./input-handler.js').InputHandler} The input handler instance.
   */
  #inputHandler;

  /**
   * @private
   * @type {boolean} A flag to control the execution of the main loop.
   */
  #isRunning = false;

  /**
   * @private
   * @type {string | null} The ID of the player entity.
   */
  #playerEntityId = null;

  /**
   * Creates a new GameLoop instance.
   *
   * @param {object} options - The core components required for the game loop.
   * @param {import('../ecs/index.js').World} options.world - The ECS world containing entities, components, and systems.
   * @param {import('./renderer.js').Renderer} options.renderer - The object responsible for drawing the game state.
   * @param {import('./input-handler.js').InputHandler} options.inputHandler - The object responsible for capturing player input.
   */
  constructor({ world, renderer, inputHandler }) {
    super();

    if (!world || !renderer || !inputHandler) {
      throw new Error('GameLoop requires a world, renderer, and inputHandler to be provided.');
    }

    this.#world = world;
    this.#renderer = renderer;
    this.#inputHandler = inputHandler;

    // Bind the input handler's event to the loop's processing logic.
    this.#inputHandler.on('action', this.#handlePlayerAction.bind(this));
  }

  /**
   * Starts the main game loop.
   *
   * @param {string} playerEntityId - The unique ID of the entity controlled by the player.
   * This is needed to determine when it's the player's turn to act.
   */
  async start(playerEntityId) {
    if (this.#isRunning) {
      console.warn('[GameLoop] The loop is already running.');
      return;
    }
    if (!playerEntityId || typeof playerEntityId !== 'string') {
        throw new Error('A valid playerEntityId must be provided to start the game loop.');
    }

    this.#playerEntityId = playerEntityId;
    this.#isRunning = true;
    this.emit('start');
    console.log('Game loop started.');

    // Initial render before the first turn.
    this.#render();

    // The main loop is driven by player input. It will wait here until an action is received.
    // The #handlePlayerAction method will then advance the game state.
  }

  /**
   * Stops the main game loop and performs necessary cleanup.
   */
  stop() {
    if (!this.#isRunning) {
      return;
    }
    this.#isRunning = false;
    this.#inputHandler.stop();
    this.emit('stop');
    console.log('Game loop stopped.');
  }

  /**
   * @private
   * Handles the 'action' event from the InputHandler. This is the entry point for a new turn.
   *
   * @param {object} action - The action object emitted by the input handler (e.g., { type: 'move', payload: { dx: 0, dy: -1 } }).
   */
  #handlePlayerAction(action) {
    if (!this.#isRunning) return;

    // A special action to quit the game.
    if (action.type === 'quit') {
      this.stop();
      return;
    }

    // Process the player's turn, then the rest of the game world's turn.
    this.#tick(action);
  }

  /**
   * @private
   * Executes a single game tick, which constitutes one full turn.
   *
   * @param {object} playerAction - The action taken by the player for this turn.
   */
  #tick(playerAction) {
    // 1. Update ECS Systems
    // The systems will process the player's action, update AI, handle combat, etc.
    // We pass the player's entity ID and their action so systems can differentiate
    // between player-driven events and AI-driven events.
    this.#world.systemManager.update(this.#world, {
      playerEntityId: this.#playerEntityId,
      playerAction,
    });

    // 2. Process Entity Destruction
    // After all systems have run, clean up any entities that were marked for destruction.
    // This deferred deletion prevents systems from operating on stale or invalid entity data mid-tick.
    const destroyedEntities = this.#world.entityManager.processDestructionQueue();
    if (destroyedEntities.size > 0) {
      this.#world.componentManager.onEntitiesDestroyed(destroyedEntities);
      // If the player entity was destroyed, it's game over.
      if (destroyedEntities.has(this.#playerEntityId)) {
        this.#handleGameOver();
        return;
      }
    }

    // 3. Render the new game state
    this.#render();

    // The loop now implicitly waits for the next 'action' event from the InputHandler.
  }

  /**
   * @private
   * Renders the current state of the game world using the renderer.
   */
  #render() {
    try {
      this.#renderer.render(this.#world, this.#playerEntityId);
    } catch (error) {
      console.error('An error occurred during rendering:', error);
      // Depending on the severity, we might want to stop the loop.
      this.stop();
    }
  }

  /**
   * @private
   * Handles the game-over state.
   * This is typically triggered when the player entity is destroyed.
   */
  #handleGameOver() {
    this.emit('gameOver');
    console.log('Game Over.');
    // The final state is rendered by the renderer's 'gameOver' message logic.
    this.#renderer.render(this.#world, this.#playerEntityId, { isGameOver: true });
    this.stop();
  }
}