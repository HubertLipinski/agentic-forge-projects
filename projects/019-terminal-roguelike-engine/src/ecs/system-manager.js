/**
 * @file src/ecs/system-manager.js
 * @description Manages the lifecycle and execution of systems in the ECS world.
 *
 * In an ECS architecture, systems contain the logic that operates on entities
 * and their components. The SystemManager is responsible for registering these
 * systems, maintaining their execution order, and running them each game tick.
 */

/**
 * Manages and executes systems in a defined order.
 *
 * This class maintains a list of system instances. Each system is an object
 * that should have an `update` method. The manager ensures systems are executed
 * in the order they are registered. This is crucial for game logic where, for
 * example, input handling must happen before movement, and movement must happen
 * before rendering.
 *
 * The `update` method of each system receives a `world` object, providing it
 * with access to the `EntityManager`, `ComponentManager`, and other core parts
 * of the game state, allowing it to query for entities and modify their components.
 */
export class SystemManager {
  /**
   * @private
   * @type {object[]}
   * An ordered list of registered system instances.
   */
  #systems;

  /**
   * Initializes a new SystemManager instance.
   */
  constructor() {
    this.#systems = [];
  }

  /**
   * Registers a system and adds it to the execution list.
   * The order of registration determines the order of execution.
   *
   * @param {object} system - An instance of a system. The system object must
   * have an `update` method. It is also good practice for it to have a `name`
   * property for debugging purposes.
   */
  registerSystem(system) {
    if (!system) {
      throw new Error('Cannot register a null or undefined system.');
    }
    if (typeof system.update !== 'function') {
      const systemName = system.constructor?.name ?? 'Unnamed System';
      throw new Error(
        `System '${systemName}' cannot be registered because it does not have an 'update' method.`
      );
    }

    this.#systems.push(system);
  }

  /**
   * Executes all registered systems in order.
   * This method should be called once per game tick by the main game loop.
   *
   * @param {object} world - The main world object, which contains references
   * to the entity and component managers, and any other shared game state.
   * This object is passed directly to each system's `update` method.
   * @param {...any} args - Additional arguments to pass to each system's update method.
   * For example, a delta time or player input object.
   */
  update(world, ...args) {
    for (const system of this.#systems) {
      // The core of the game loop's logic execution. Each system performs its
      // designated task on the game state.
      system.update(world, ...args);
    }
  }

  /**
   * Retrieves all registered systems.
   *
   * @returns {object[]} A new array containing the registered system instances.
   */
  getAllSystems() {
    return [...this.#systems];
  }

  /**
   * Clears all registered systems from the manager.
   * Useful for resetting the game state or changing game modes.
   */
  clear() {
    this.#systems = [];
  }

  /**
   * Serializes the state of the SystemManager.
   * For this particular manager, serialization is about recording the names or
   * types of the registered systems in their execution order. The actual system
   * instances are not serialized as they are stateless logic containers.
   * The game will need to re-register the actual system instances upon loading.
   *
   * @returns {{ systems: string[] }} A serializable object representing the manager's state.
   */
  serialize() {
    // Systems are logic and are generally not stateful themselves.
    // We serialize the *names* of the systems in order, assuming they can be
    // reconstructed from a factory or map during deserialization.
    // The `name` property is a convention we encourage for systems.
    const systemNames = this.#systems.map(
      (s) => s.constructor?.name ?? 'UnnamedSystem'
    );

    return {
      systems: systemNames,
    };
  }

  /**
   * Deserializes and loads the state into the SystemManager.
   * This method doesn't actually instantiate systems. It's more of a placeholder
   * or a verification step. The main game setup logic is responsible for
   * re-registering the actual system objects in the correct order after loading a game.
   * This method can be used to validate that the saved system order matches the
   * current game's system configuration if needed.
   *
   * @param {object} data - The serialized state object.
   * @param {string[]} data.systems - An array of system names in order.
   */
  deserialize(data) {
    if (!data || !Array.isArray(data.systems)) {
      throw new Error(
        'Invalid data format for SystemManager deserialization. Expected an object with a "systems" array.'
      );
    }

    // We clear the current systems. The game's loading logic is responsible
    // for re-registering the systems based on the game state.
    this.clear();

    // This method serves as a hook, but the actual re-instantiation and
    // registration of systems must be handled by the application's setup code,
    // as the SystemManager itself doesn't know how to create specific game systems.
    // For example, the `bin/game.js` or `examples/simple-roguelike/main.js`
    // would read the `data.systems` array and register the corresponding system objects.
    // console.log('SystemManager deserialized. System order to be restored:', data.systems);
  }
}