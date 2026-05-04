/**
 * @file src/state/world-state.js
 * @description Manages the entire game state, including the map, actors, and items.
 * This class acts as the single source of truth for the current state of the game world.
 * It provides a high-level API for querying and mutating the state, ensuring that all
 * changes are handled consistently. It encapsulates the collections of actors and items,
 * and holds a reference to the static dungeon map.
 */

import { DungeonMap } from '../world/map.js';
import { Actor } from '../entities/actor.js';
// Note: While WorldState doesn't directly instantiate NPCs, it needs to know about the class
// for deserialization purposes. A more advanced implementation might use a factory pattern.
import { Npc } from '../entities/npc.js';
import { findPath } from '../world/pathfinding.js';

/**
 * Manages the comprehensive state of the game world.
 */
export class WorldState {
  /**
   * The static dungeon map layout.
   * @type {DungeonMap}
   */
  map;

  /**
   * A map of all actors in the world, keyed by their ID.
   * @type {Map<string, Actor>}
   */
  #actors;

  /**
   * A map of all items in the world, keyed by their ID.
   * (Currently a placeholder for future item implementation).
   * @type {Map<string, object>}
   */
  #items;

  /**
   * The rate at which the game engine ticks, in milliseconds.
   * Stored here for use by state-dependent logic like FSM timers.
   * @type {number}
   */
  tickRate;

  /**
   * A reference to the global event bus for emitting game events.
   * @type {import('../game/event-bus.js').EventBus}
   */
  eventBus;

  /**
   * Initializes a new WorldState.
   *
   * @param {DungeonMap} dungeonMap - An instance of the DungeonMap.
   * @param {import('../game/event-bus.js').EventBus} eventBus - The game's event bus.
   * @param {number} [tickRate=100] - The game engine's tick rate in ms.
   */
  constructor(dungeonMap, eventBus, tickRate = 100) {
    if (!(dungeonMap instanceof DungeonMap)) {
      throw new Error('WorldState requires a valid DungeonMap instance.');
    }
    if (!eventBus || typeof eventBus.emit !== 'function') {
      throw new Error('WorldState requires a valid EventBus instance.');
    }

    this.map = dungeonMap;
    this.eventBus = eventBus;
    this.tickRate = tickRate;
    this.#actors = new Map();
    this.#items = new Map();
  }

  // --- Actor Management ---

  /**
   * Adds an actor to the world.
   * @param {Actor} actor - The actor instance to add.
   * @returns {boolean} True if the actor was added successfully, false if an actor with the same ID already exists.
   */
  addActor(actor) {
    if (!(actor instanceof Actor)) {
      console.error('Attempted to add an invalid object as an actor.');
      return false;
    }
    if (this.#actors.has(actor.id)) {
      console.warn(`Actor with ID ${actor.id} already exists in the world.`);
      return false;
    }
    this.#actors.set(actor.id, actor);
    return true;
  }

  /**
   * Removes an actor from the world by their ID.
   * @param {string} actorId - The ID of the actor to remove.
   * @returns {boolean} True if the actor was found and removed, false otherwise.
   */
  removeActor(actorId) {
    const actor = this.#actors.get(actorId);
    if (actor) {
      // If the actor is an NPC, ensure its FSM is cleaned up if necessary.
      // This helps prevent memory leaks from timers or other async operations in the FSM.
      if (actor.fsm && typeof actor.fsm.cleanup === 'function') {
        actor.fsm.cleanup();
      }
      return this.#actors.delete(actorId);
    }
    return false;
  }

  /**
   * Retrieves an actor by their ID.
   * @param {string} actorId - The ID of the actor to find.
   * @returns {Actor | undefined} The actor instance, or undefined if not found.
   */
  getActorById(actorId) {
    return this.#actors.get(actorId);
  }

  /**
   * Retrieves all actors in the world.
   * @returns {Actor[]} An array of all actor instances.
   */
  getAllActors() {
    return Array.from(this.#actors.values());
  }

  /**
   * Retrieves all player actors in the world.
   * Players are identified by having a `clientSessionId` property.
   * @returns {Actor[]} An array of all player actor instances.
   */
  getPlayers() {
    return this.getAllActors().filter(actor => actor.clientSessionId);
  }

  /**
   * Retrieves all non-player character (NPC) actors in the world.
   * NPCs are identified by NOT having a `clientSessionId` property.
   * @returns {Actor[]} An array of all NPC actor instances.
   */
  getNpcs() {
    return this.getAllActors().filter(actor => !actor.clientSessionId);
  }

  /**
   * Finds the nearest player to a given actor within a specified maximum distance.
   * @param {Actor} fromActor - The actor to measure distance from.
   * @param {number} maxDistance - The maximum Manhattan distance to search.
   * @returns {Actor | null} The nearest player actor, or null if no players are within range.
   */
  findNearestPlayer(fromActor, maxDistance) {
    let nearestPlayer = null;
    let minDistance = Infinity;

    for (const player of this.getPlayers()) {
      if (player.id === fromActor.id) continue;

      const distance = Math.abs(fromActor.x - player.x) + Math.abs(fromActor.y - player.y);

      if (distance <= maxDistance && distance < minDistance) {
        minDistance = distance;
        nearestPlayer = player;
      }
    }
    return nearestPlayer;
  }

  // --- Position and Movement ---

  /**
   * Checks if a specific map position is available (walkable and not occupied by another actor).
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {string} [excludeActorId] - An optional actor ID to exclude from the check (e.g., the actor that is moving).
   * @returns {boolean} True if the position is available, false otherwise.
   */
  isPositionAvailable(x, y, excludeActorId) {
    if (!this.map.isWalkable(x, y)) {
      return false;
    }
    for (const actor of this.#actors.values()) {
      if (actor.id !== excludeActorId && actor.x === x && actor.y === y) {
        return false;
      }
    }
    return true;
  }

  /**
   * Moves an actor to a new position. This is a high-level mutation that performs checks.
   * @param {string} actorId - The ID of the actor to move.
   * @param {number} newX - The target x-coordinate.
   * @param {number} newY - The target y-coordinate.
   * @returns {boolean} True on successful move, false if the move is invalid.
   */
  moveActor(actorId, newX, newY) {
    const actor = this.getActorById(actorId);
    if (!actor) {
      console.error(`Attempted to move non-existent actor with ID: ${actorId}`);
      return false;
    }

    if (this.isPositionAvailable(newX, newY, actorId)) {
      actor.moveTo(newX, newY);
      this.eventBus.emit('actorMoved', { actorId, x: newX, y: newY });
      return true;
    }
    return false;
  }

  /**
   * Retrieves an actor at a specific position.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {Actor | undefined} The actor at the position, or undefined if none.
   */
  getActorAt(x, y) {
    for (const actor of this.#actors.values()) {
      if (actor.x === x && actor.y === y) {
        return actor;
      }
    }
    return undefined;
  }

  // --- Combat ---

  /**
   * Executes an attack from one actor to another.
   * @param {string} attackerId - The ID of the attacking actor.
   * @param {string} targetId - The ID of the target actor.
   */
  attack(attackerId, targetId) {
    const attacker = this.getActorById(attackerId);
    const target = this.getActorById(targetId);

    if (!attacker || !target) {
      console.warn('Attack failed: Attacker or target not found.');
      return;
    }

    // Basic damage calculation: attacker's attack minus target's defense.
    const damage = Math.max(1, attacker.attack - target.defense);
    target.takeDamage(damage);

    this.eventBus.emit('attack', { attacker, target, damage });

    if (!target.isAlive()) {
      this.eventBus.emit('actorDied', { actor: target, killer: attacker });
      // In a real game, you might drop loot here.
      // For now, we just remove the actor if it's an NPC.
      if (!target.clientSessionId) {
        this.removeActor(target.id);
      }
    }
  }

  // --- Serialization / Deserialization ---

  /**
   * Serializes the entire world state into a plain JavaScript object.
   * @returns {object} A serializable representation of the world state.
   */
  serialize() {
    const serializedActors = this.getAllActors().map(actor => actor.serialize());
    return {
      map: this.map.serialize(),
      actors: serializedActors,
      // items: ... // Future: serialize items
    };
  }

  /**
   * Creates a WorldState instance from serialized data.
   * @param {object} data - The serialized world state data.
   * @param {import('../game/event-bus.js').EventBus} eventBus - The game's event bus.
   * @param {number} tickRate - The game engine's tick rate.
   * @returns {WorldState} A new WorldState instance.
   */
  static deserialize(data, eventBus, tickRate) {
    if (!data || !data.map || !data.actors) {
      throw new Error('Cannot deserialize WorldState: data is malformed or incomplete.');
    }

    const dungeonMap = DungeonMap.deserialize(data.map);
    const worldState = new WorldState(dungeonMap, eventBus, tickRate);

    // Actor deserialization requires a mapping of type to class
    const actorClassMap = {
      'Actor': Actor,
      'Npc': Npc,
      // 'Player': Player, // If a specific Player class exists
    };

    for (const actorData of data.actors) {
      const ActorClass = actorClassMap[actorData.type] || Actor;
      const actor = ActorClass.deserialize(actorData);
      worldState.addActor(actor);
    }

    // Future: deserialize items
    // ...

    return worldState;
  }
}