/**
 * @file src/ecs/entity-manager.js
 * @description Manages the lifecycle of entities in the ECS world.
 *
 * An entity is simply a unique identifier. It has no data or behavior on its
 * own. It serves as a key to associate various components that define its
 * properties and state.
 */

import { nanoid } from 'nanoid';

/**
 * Manages the creation, deletion, and querying of entities.
 *
 * This class uses a Set to store active entity IDs, providing efficient
 * O(1) average time complexity for additions, deletions, and lookups.
 * It uses `nanoid` to generate short, URL-friendly, and highly unique
 * identifiers for entities, which is useful for debugging and serialization.
 */
export class EntityManager {
  /**
   * @private
   * @type {Set<string>}
   * A set of all currently active entity IDs.
   */
  #entities;

  /**
   * @private
   * @type {Set<string>}
   * A queue of entities marked for destruction at the end of the current game tick.
   * This deferred deletion prevents issues where an entity is destroyed mid-update,
   * which could cause systems to operate on invalid data.
   */
  #entitiesToDestroy;

  /**
   * Initializes a new EntityManager instance.
   */
  constructor() {
    this.#entities = new Set();
    this.#entitiesToDestroy = new Set();
  }

  /**
   * Creates a new entity with a unique ID.
   *
   * @returns {string} The unique ID of the newly created entity.
   */
  createEntity() {
    // nanoid is extremely fast and provides a good balance of brevity and
    // collision resistance, suitable for game entities.
    const entityId = nanoid(10);
    this.#entities.add(entityId);
    return entityId;
  }

  /**
   * Schedules an entity to be destroyed at the end of the current game tick.
   *
   * The actual removal is deferred to the `processDestructionQueue` method,
   * which should be called by the main game loop or world manager after all
   * systems have finished their updates for the turn.
   *
   * @param {string} entityId - The ID of the entity to destroy.
   */
  destroyEntity(entityId) {
    if (this.hasEntity(entityId)) {
      this.#entitiesToDestroy.add(entityId);
    }
  }

  /**
   * Processes the queue of entities marked for destruction.
   * This method should be called once per game tick, after all other logic.
   *
   * @returns {Set<string>} A set of the entity IDs that were actually destroyed.
   * This can be passed to other managers (e.g., ComponentManager) to clean up
   * associated data.
   */
  processDestructionQueue() {
    if (this.#entitiesToDestroy.size === 0) {
      return new Set();
    }

    // Create a copy of the set to return, as we are about to clear the original.
    const destroyed = new Set(this.#entitiesToDestroy);

    for (const entityId of destroyed) {
      this.#entities.delete(entityId);
    }

    this.#entitiesToDestroy.clear();

    return destroyed;
  }

  /**
   * Checks if an entity with the given ID exists and is currently active.
   *
   * @param {string} entityId - The ID of the entity to check.
   * @returns {boolean} `true` if the entity exists, `false` otherwise.
   */
  hasEntity(entityId) {
    return this.#entities.has(entityId);
  }

  /**
   * Retrieves a set of all currently active entity IDs.
   *
   * @returns {Set<string>} A read-only set of all active entity IDs.
   * Note: Modifying the returned set will not affect the EntityManager's internal state.
   */
  getAllEntities() {
    return new Set(this.#entities);
  }

  /**
   * Returns the total number of active entities.
   *
   * @returns {number} The count of active entities.
   */
  getEntityCount() {
    return this.#entities.size;
  }

  /**
   * Serializes the state of the EntityManager.
   * This captures all active entity IDs for saving the game state.
   * Entities queued for destruction are not included, as they are considered
   * gone from the perspective of a saved state.
   *
   * @returns {{entities: string[]}} A serializable object representing the manager's state.
   */
  serialize() {
    return {
      entities: [...this.#entities],
    };
  }

  /**
   * Deserializes and loads the state into the EntityManager.
   * This completely replaces the current set of entities with the loaded data.
   *
   * @param {object} data - The serialized state object.
   * @param {string[]} data.entities - An array of entity IDs to load.
   */
  deserialize(data) {
    if (!data || !Array.isArray(data.entities)) {
      throw new Error(
        'Invalid data format for EntityManager deserialization. Expected an object with an "entities" array.'
      );
    }

    this.#entities = new Set(data.entities);
    this.#entitiesToDestroy.clear();
  }
}