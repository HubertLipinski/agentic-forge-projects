/**
 * @file src/entities/npc-fsm.js
 * @description A Finite State Machine for controlling NPC behavior.
 * This file defines the different states an NPC can be in (e.g., wandering, idle, aggressive)
 * and the logic for transitioning between them. Each state dictates the NPC's actions
 * during a game tick. This approach creates more dynamic and believable NPC behavior
 * by encapsulating logic for different situations.
 */

import { findPath } from '../world/pathfinding.js';

/**
 * Base class for all NPC states. Defines the interface that all concrete states must implement.
 * @abstract
 */
class State {
  /**
   * Enters this state for a given NPC. This method is called once when the FSM
   * transitions into this state. It's a good place for one-time setup.
   * @param {import('./actor.js').Actor} npc - The NPC entering this state.
   * @param {import('../state/world-state.js').WorldState} worldState - The current world state.
   */
  enter(npc, worldState) {}

  /**
   * Executes the behavior for this state. This method is called on every game tick
   * that the NPC is in this state. It should return a new state to transition to,
   * or `this` to remain in the current state.
   * @param {import('./actor.js').Actor} npc - The NPC executing this state's logic.
   * @param {import('../state/world-state.js').WorldState} worldState - The current world state.
   * @returns {State} The next state for the FSM.
   * @abstract
   */
  execute(npc, worldState) {
    throw new Error('State.execute() must be implemented by subclasses.');
  }

  /**
   * Exits this state for a given NPC. This method is called once when the FSM
   * transitions out of this state. It's a good place for cleanup.
   * @param {import('./actor.js').Actor} npc - The NPC exiting this state.
   * @param {import('../state/world-state.js').WorldState} worldState - The current world state.
   */
  exit(npc, worldState) {}
}

/**
 * The Idle state. The NPC remains stationary for a set duration, looking for
 * potential targets. If a target is found, it transitions to AggroState.
 * Otherwise, it transitions to WanderState after its timer expires.
 */
export class IdleState extends State {
  constructor() {
    super();
    this.name = 'idle';
    /** @private */
    this.idleDuration = 0;
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   * @param {import('../state/world-state.js').WorldState} worldState
   */
  enter(npc, worldState) {
    // Set a random idle duration between 3 and 8 seconds (in ticks)
    const ticksPerSecond = 1000 / worldState.tickRate;
    this.idleDuration = (3 + Math.random() * 5) * ticksPerSecond;
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   * @param {import('../state/world-state.js').WorldState} worldState
   * @returns {State}
   */
  execute(npc, worldState) {
    // 1. Check for nearby players to become aggressive
    const target = worldState.findNearestPlayer(npc, 8); // 8-tile vision range
    if (target) {
      npc.fsmContext.targetId = target.id;
      return new AggroState();
    }

    // 2. Decrement idle timer
    this.idleDuration--;
    if (this.idleDuration <= 0) {
      return new WanderState();
    }

    // 3. Remain idle
    return this;
  }
}

/**
 * The Wander state. The NPC moves to a random nearby walkable tile. Once it
 * reaches its destination, it transitions to IdleState. If it spots a target,
 * it transitions to AggroState.
 */
export class WanderState extends State {
  constructor() {
    super();
    this.name = 'wander';
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   * @param {import('../state/world-state.js').WorldState} worldState
   */
  enter(npc, worldState) {
    const { x, y } = npc;
    const wanderRadius = 5;
    let targetPos = null;

    // Try to find a random walkable tile nearby
    for (let i = 0; i < 10; i++) { // Max 10 attempts
      const targetX = x + Math.floor(Math.random() * (wanderRadius * 2 + 1)) - wanderRadius;
      const targetY = y + Math.floor(Math.random() * (wanderRadius * 2 + 1)) - wanderRadius;

      if (worldState.map.isWalkable(targetX, targetY)) {
        targetPos = { x: targetX, y: targetY };
        break;
      }
    }

    if (targetPos) {
      npc.fsmContext.path = findPath({ x, y }, targetPos, worldState.map);
    } else {
      // If no path found, just go idle immediately
      npc.fsmContext.path = [];
    }
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   * @param {import('../state/world-state.js').WorldState} worldState
   * @returns {State}
   */
  execute(npc, worldState) {
    // 1. Check for nearby players to become aggressive
    const target = worldState.findNearestPlayer(npc, 8);
    if (target) {
      npc.fsmContext.targetId = target.id;
      return new AggroState();
    }

    // 2. If path is finished or doesn't exist, go idle
    if (!npc.fsmContext.path || npc.fsmContext.path.length === 0) {
      return new IdleState();
    }

    // 3. Move along the path
    const nextStep = npc.fsmContext.path.shift();
    if (nextStep && worldState.isPositionAvailable(nextStep.x, nextStep.y)) {
      worldState.moveActor(npc.id, nextStep.x, nextStep.y);
    } else {
      // Path is blocked, stop wandering and go idle
      npc.fsmContext.path = [];
      return new IdleState();
    }

    // 4. Continue wandering
    return this;
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   */
  exit(npc) {
    // Clean up path data
    npc.fsmContext.path = null;
  }
}

/**
 * The Aggro state. The NPC has a target (usually a player) and will actively
 * pursue and attack them. If the target moves out of range or is defeated,
 * the NPC will transition back to WanderState.
 */
export class AggroState extends State {
  constructor() {
    super();
    this.name = 'aggro';
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   * @param {import('../state/world-state.js').WorldState} worldState
   * @returns {State}
   */
  execute(npc, worldState) {
    const target = worldState.getActorById(npc.fsmContext.targetId);

    // 1. Check if target is gone (disconnected, defeated, etc.)
    if (!target || !target.isAlive()) {
      npc.fsmContext.targetId = null;
      return new WanderState();
    }

    const distance = Math.abs(npc.x - target.x) + Math.abs(npc.y - target.y);

    // 2. If target is too far away, lose aggro
    const deAggroRange = 15;
    if (distance > deAggroRange) {
      npc.fsmContext.targetId = null;
      worldState.eventBus.emit('actorMessage', { actorId: npc.id, message: `${npc.name} gives up the chase.` });
      return new WanderState();
    }

    // 3. If in attack range (adjacent), attack!
    if (distance === 1) {
      worldState.attack(npc.id, target.id);
      return this; // Stay in AggroState to continue attacking
    }

    // 4. If not in attack range, move towards target
    // Recalculate path every tick to adapt to target movement
    const path = findPath({ x: npc.x, y: npc.y }, { x: target.x, y: target.y }, worldState.map);

    if (path && path.length > 0) {
      const nextStep = path[0];
      if (worldState.isPositionAvailable(nextStep.x, nextStep.y)) {
        worldState.moveActor(npc.id, nextStep.x, nextStep.y);
      }
      // If path is blocked, do nothing this tick (wait for it to clear)
    }
    // If no path exists, do nothing (target is unreachable)

    // 5. Remain aggressive
    return this;
  }

  /**
   * @override
   * @param {import('./actor.js').Actor} npc
   */
  exit(npc) {
    // Clean up target and path data
    npc.fsmContext.targetId = null;
    npc.fsmContext.path = null;
  }
}

/**
 * Manages an NPC's state transitions. Each NPC will have an instance of this FSM.
 */
export class NpcFSM {
  /**
   * @param {import('./actor.js').Actor} npc - The NPC this FSM will control.
   */
  constructor(npc) {
    /** @private */
    this.npc = npc;
    /** @private */
    this.currentState = new IdleState();

    // Initialize a context object on the NPC to store state-related data
    if (!this.npc.fsmContext) {
      this.npc.fsmContext = {
        targetId: null,
        path: null,
      };
    }

    this.currentState.enter(this.npc);
  }

  /**
   * Updates the FSM by executing the current state's logic. This should be
   * called once per game tick for the associated NPC.
   * @param {import('../state/world-state.js').WorldState} worldState - The current world state.
   */
  update(worldState) {
    const nextState = this.currentState.execute(this.npc, worldState);

    if (nextState !== this.currentState) {
      this.currentState.exit(this.npc, worldState);
      this.currentState = nextState;
      this.currentState.enter(this.npc, worldState);
    }
  }

  /**
   * Gets the name of the current state.
   * @returns {string}
   */
  getCurrentStateName() {
    return this.currentState.name;
  }

  /**
   * Serializes the FSM's current state for persistence.
   * @returns {{currentStateName: string}}
   */
  serialize() {
    return {
      currentStateName: this.currentState.name,
      // fsmContext is serialized as part of the NPC actor itself
    };
  }

  /**
   * Deserializes the FSM state and restores it.
   * @param {{currentStateName: string}} data - The serialized FSM data.
   */
  deserialize(data) {
    let restoredState;
    switch (data.currentStateName) {
      case 'wander':
        restoredState = new WanderState();
        break;
      case 'aggro':
        restoredState = new AggroState();
        break;
      case 'idle':
      default:
        restoredState = new IdleState();
        break;
    }
    this.currentState = restoredState;
    // The `enter` method is not called on deserialization to avoid
    // re-initializing state logic (e.g., finding a new wander path).
    // The FSM will resume its logic on the next `update` call.
  }
}