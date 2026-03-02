/**
 * @file src/ecs/component-manager.js
 * @description Manages component data and its association with entities.
 *
 * In an ECS architecture, components are pure data objects that define the
 * properties of an entity. This manager stores all components of a given type
 * together, which is a key aspect of data-oriented design, promoting efficient
* memory access and iteration by systems.
 */

/**
 * Manages the registration, addition, removal, and querying of components.
 *
 * This class uses a Map-based approach for storing component data. The primary
 * data structure is a Map where keys are component names (strings) and values
 * are another Map. This inner Map stores entity IDs as keys and the actual
 * component data object as values.
 *
 * Example structure:
 * `componentStores` -> {
 *   'Position': Map { 'entityId1' => { x: 10, y: 20 }, 'entityId2' => { x: 5, y: 8 } },
 *   'Renderable': Map { 'entityId1' => { char: '@', color: 'white' } }
 * }
 *
 * This design allows for fast O(1) lookups for a specific component on a
 * specific entity, and efficient iteration over all entities that possess a
 * certain component.
 */
export class ComponentManager {
  /**
   * @private
   * @type {Map<string, Map<string, object>>}
   * Stores all component data, organized by component name.
   */
  #componentStores;

  /**
   * @private
   * @type {Map<string, Function>}
   * A map of registered component "factories" or constructors.
   * This is used to create new instances of components.
   */
  #componentFactories;

  /**
   * Initializes a new ComponentManager instance.
   */
  constructor() {
    this.#componentStores = new Map();
    this.#componentFactories = new Map();
  }

  /**
   * Registers a component type with the manager.
   * All component types must be registered before they can be used.
   * Registration prevents typos in component names and helps organize component creation.
   *
   * @param {string} componentName - The unique name for the component type (e.g., 'Position').
   * @param {Function} [factory] - An optional factory function that returns a new component object.
   * If not provided, a default factory creating an empty object is used.
   */
  registerComponent(componentName, factory) {
    if (typeof componentName !== 'string' || componentName.length === 0) {
      throw new Error('Component name must be a non-empty string.');
    }
    if (this.#componentStores.has(componentName)) {
      console.warn(`[ComponentManager] Component '${componentName}' is already registered. Overwriting.`);
    }

    this.#componentStores.set(componentName, new Map());
    this.#componentFactories.set(componentName, factory ?? (() => ({})));
  }

  /**
   * Adds a component to an entity.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to add.
   * @param {object} [initialData={}] - The initial data for the component. This will be merged
   * with the default data from the component's factory function.
   * @returns {object} The final component data object that was added.
   */
  addComponent(entityId, componentName, initialData = {}) {
    const store = this.#componentStores.get(componentName);
    if (!store) {
      throw new Error(`Component type '${componentName}' is not registered.`);
    }
    if (store.has(entityId)) {
      console.warn(`[ComponentManager] Entity '${entityId}' already has component '${componentName}'. Overwriting.`);
    }

    const factory = this.#componentFactories.get(componentName);
    const componentData = { ...factory(), ...initialData };

    store.set(entityId, componentData);
    return componentData;
  }

  /**
   * Removes a component from an entity.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to remove.
   * @returns {boolean} `true` if the component was successfully removed, `false` otherwise.
   */
  removeComponent(entityId, componentName) {
    const store = this.#componentStores.get(componentName);
    if (store) {
      return store.delete(entityId);
    }
    return false;
  }

  /**
   * Retrieves the component data for a specific entity.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to retrieve.
   * @returns {object | undefined} The component data object, or `undefined` if the entity
   * does not have this component.
   */
  getComponent(entityId, componentName) {
    return this.#componentStores.get(componentName)?.get(entityId);
  }

  /**
   * Checks if an entity has a specific component.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentName - The name of the component type to check for.
   * @returns {boolean} `true` if the entity has the component, `false` otherwise.
   */
  hasComponent(entityId, componentName) {
    return this.#componentStores.get(componentName)?.has(entityId) ?? false;
  }

  /**
   * Retrieves all components associated with a single entity.
   *
   * @param {string} entityId - The ID of the entity.
   * @returns {Map<string, object>} A map where keys are component names and values are
   * the corresponding component data objects for the given entity.
   */
  getEntityComponents(entityId) {
    const components = new Map();
    for (const [componentName, store] of this.#componentStores.entries()) {
      if (store.has(entityId)) {
        components.set(componentName, store.get(entityId));
      }
    }
    return components;
  }

  /**
   * Retrieves all entities that have a specific set of components.
   * This is a core query method used by systems to get the entities they need to process.
   *
   * @param {string[]} componentNames - An array of component names to query for.
   * @returns {string[]} An array of entity IDs that have all the specified components.
   */
  queryEntitiesByComponents(componentNames) {
    if (!Array.isArray(componentNames) || componentNames.length === 0) {
      return [];
    }

    // Find the smallest component store to iterate over for efficiency.
    let smallestStore;
    let smallestSize = Infinity;
    for (const name of componentNames) {
      const store = this.#componentStores.get(name);
      if (!store) return []; // If any component type doesn't exist, no entities can match.
      if (store.size < smallestSize) {
        smallestStore = store;
        smallestSize = store.size;
      }
    }

    if (!smallestStore) return [];

    const matchingEntities = [];
    const otherComponentNames = componentNames.filter(name => this.#componentStores.get(name) !== smallestStore);

    // Iterate over the smallest set of entities and check if they have the other required components.
    for (const entityId of smallestStore.keys()) {
      const hasAll = otherComponentNames.every(name => this.#componentStores.get(name).has(entityId));
      if (hasAll) {
        matchingEntities.push(entityId);
      }
    }

    return matchingEntities;
  }

  /**
   * Removes all components associated with a set of destroyed entities.
   * This is a cleanup operation typically called after the EntityManager processes its destruction queue.
   *
   * @param {Set<string>} destroyedEntityIds - A set of entity IDs that have been destroyed.
   */
  onEntitiesDestroyed(destroyedEntityIds) {
    if (destroyedEntityIds.size === 0) return;

    for (const entityId of destroyedEntityIds) {
      for (const store of this.#componentStores.values()) {
        store.delete(entityId);
      }
    }
  }

  /**
   * Serializes the state of the ComponentManager.
   * This captures all component data for saving the game state.
   * Uses `structuredClone` to ensure a deep copy, preventing any mutation
   * of the live game state.
   *
   * @returns {{ stores: [string, [string, object][]][] }} A serializable object representing the manager's state.
   */
  serialize() {
    const serializedStores = [];
    for (const [name, store] of this.#componentStores.entries()) {
      // Convert the inner Map to an array of [key, value] pairs for JSON compatibility.
      serializedStores.push([name, [...store.entries()]]);
    }
    // Deep clone to prevent any accidental mutation of the live state.
    return { stores: structuredClone(serializedStores) };
  }

  /**
   * Deserializes and loads the state into the ComponentManager.
   * This completely replaces the current component data with the loaded data.
   * It assumes that all necessary component types have already been registered.
   *
   * @param {object} data - The serialized state object.
   * @param {[string, [string, object][]][]} data.stores - The serialized component stores.
   */
  deserialize(data) {
    if (!data || !Array.isArray(data.stores)) {
      throw new Error(
        'Invalid data format for ComponentManager deserialization. Expected an object with a "stores" array.'
      );
    }

    // Clear existing data before loading.
    for (const store of this.#componentStores.values()) {
      store.clear();
    }

    for (const [componentName, entries] of data.stores) {
      const store = this.#componentStores.get(componentName);
      if (!store) {
        console.warn(
          `[ComponentManager] Deserialization encountered unregistered component type '${componentName}'. Skipping.`
        );
        continue;
      }

      // Reconstruct the Map from the array of [key, value] pairs.
      const newStore = new Map(entries);
      this.#componentStores.set(componentName, newStore);
    }
  }
}