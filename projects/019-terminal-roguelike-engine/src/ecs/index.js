/**
 * @file src/ecs/index.js
 * @description Exports the core ECS classes and a unified `World` class.
 *
 * This file serves as the main entry point for the Entity-Component-System (ECS)
 * architecture. It brings together the `EntityManager`, `ComponentManager`, and
 * `SystemManager` into a single, cohesive `World` object. This `World` object
 * represents the entire game state and logic, providing a convenient and
 * centralized point of access for other parts of the engine, such as the game
 * loop and renderer.
 */

import { EntityManager } from './entity-manager.js';
import { ComponentManager } from './component-manager.js';
import { SystemManager } from './system-manager.js';

/**
 * The `World` class encapsulates the entire state of the game's
 * Entity-Component-System. It holds the managers for entities, components,
 * and systems, providing a single, unified interface to interact with the ECS.
 *
 * This class acts as a facade, simplifying the creation and management of the
 * core ECS components. It is the primary object passed to systems during their
 * update phase, giving them access to the game state they need to operate on.
 */
export class World {
  /**
   * Manages the lifecycle of all entities.
   * @type {EntityManager}
   */
  entityManager;

  /**
   * Manages the data for all components.
   * @type {ComponentManager}
   */
  componentManager;

  /**
   * Manages the execution of all game logic systems.
   * @type {SystemManager}
   */
  systemManager;

  /**
   * A general-purpose key-value store for global game state that doesn't
   * fit neatly into the ECS structure. Examples include the game map,
   * player entity ID, turn count, or message log.
   * @type {Map<string, any>}
   */
  globals;

  /**
   * Initializes a new World instance, creating its own set of managers.
   */
  constructor() {
    this.entityManager = new EntityManager();
    this.componentManager = new ComponentManager();
    this.systemManager = new SystemManager();
    this.globals = new Map();
  }

  /**
   * Creates a new entity and returns its ID.
   * This is a convenience method that delegates to the EntityManager.
   *
   * @returns {string} The unique ID of the newly created entity.
   */
  createEntity() {
    return this.entityManager.createEntity();
  }

  /**
   * Schedules an entity for destruction at the end of the current tick.
   * This is a convenience method that delegates to the EntityManager.
   *
   * @param {string} entityId - The ID of the entity to destroy.
   */
  destroyEntity(entityId) {
    this.entityManager.destroyEntity(entityId);
  }

  /**
   * Adds a component to an entity.
   * This is a convenience method that delegates to the ComponentManager.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to add.
   * @param {object} [initialData={}] - The initial data for the component.
   * @returns {object} The final component data object that was added.
   */
  addComponent(entityId, componentName, initialData = {}) {
    return this.componentManager.addComponent(entityId, componentName, initialData);
  }

  /**
   * Retrieves a component's data for a specific entity.
   * This is a convenience method that delegates to the ComponentManager.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to retrieve.
   * @returns {object | undefined} The component data object, or undefined.
   */
  getComponent(entityId, componentName) {
    return this.componentManager.getComponent(entityId, componentName);
  }

  /**
   * Serializes the entire state of the World.
   * This method orchestrates the serialization of each manager and any
   * global state, packaging it into a single object suitable for saving.
   *
   * @returns {object} A serializable object representing the complete game world state.
   */
  serialize() {
    // Note: The game map in `globals` needs special handling for serialization
    // if it contains class instances (like Tile). The StateManager will handle this.
    // Here, we use structuredClone for a robust deep copy of globals.
    const serializedGlobals = [];
    for (const [key, value] of this.globals.entries()) {
        serializedGlobals.push([key, structuredClone(value)]);
    }

    return {
      entityManager: this.entityManager.serialize(),
      componentManager: this.componentManager.serialize(),
      systemManager: this.systemManager.serialize(),
      globals: serializedGlobals,
    };
  }

  /**
   * Deserializes and loads a state into the World.
   * This method orchestrates the deserialization for each manager,
   * completely replacing the current world state with the loaded data.
   *
   * @param {object} data - The serialized world state object.
   * @throws {Error} If the data format is invalid.
   */
  deserialize(data) {
    if (!data || !data.entityManager || !data.componentManager || !data.systemManager || !data.globals) {
      throw new Error('Invalid data format for World deserialization. Required managers are missing.');
    }

    // The order is important: systems are often dependent on components and entities.
    // While system deserialization is a placeholder, managers with state must be loaded.
    this.entityManager.deserialize(data.entityManager);
    this.componentManager.deserialize(data.componentManager);
    this.systemManager.deserialize(data.systemManager); // Primarily for validation/logging
    this.globals = new Map(data.globals);
  }
}

// Export the individual manager classes as well, allowing for more advanced
// or direct usage if needed by the game developer.
export { EntityManager, ComponentManager, SystemManager };