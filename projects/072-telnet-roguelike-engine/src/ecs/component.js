/**
 * @file src/ecs/component.js
 * @description Base class for all components in the ECS architecture.
 */

/**
 * Represents a Component in the Entity-Component-System (ECS) architecture.
 *
 * Components are designed to be simple data containers that hold the state
 * for a specific aspect of an entity. They should not contain complex logic;
 * that is the responsibility of Systems.
 *
 * This base class provides a common structure and a `clone` method, which is
 * crucial for creating new component instances from templates or for state
 * management tasks like saving and loading.
 *
 * In this engine, components are instantiated with an initial state object.
 * The properties of this object are copied directly onto the component instance.
 * This makes component creation flexible and data-driven, especially when
 * loading definitions from configuration files (e.g., JSON).
 *
 * @example
 * // Define a Position component
 * class Position extends Component {
 *   constructor(x = 0, y = 0) {
 *     super({ x, y });
 *   }
 * }
 *
 * // Create an instance
 * const pos = new Position(10, 5);
 * console.log(pos.x); // 10
 *
 * // Clone the instance
 * const newPos = pos.clone();
 * console.log(newPos.x); // 10
 * newPos.x = 20;
 * console.log(pos.x); // 10 (original is unchanged)
 */
export default class Component {
    /**
     * The name of the component class. This is used by the ECS World to
     * identify and manage component types.
     * @type {string}
     */
    name;

    /**
     * Creates an instance of a Component.
     * The constructor accepts an optional `initialState` object. The properties
     * of this object are merged into the new component instance. This pattern
     * allows for easy initialization of components from data, such as from a
     * JSON configuration file.
     *
     * @param {object} [initialState={}] - An object containing the initial values for the component's properties.
     */
    constructor(initialState = {}) {
        this.name = this.constructor.name;

        // Assign all properties from the initialState object to this instance.
        // This is a core part of making components simple data bags.
        Object.assign(this, initialState);
    }

    /**
     * Creates a deep copy of the component instance.
     *
     * This is essential for various ECS operations, such as:
     * - Creating new entities from templates (prefabs).
     * - Safely modifying component state without affecting other entities.
     * - Potentially for state serialization or undo/redo systems.
     *
     * It uses the modern `structuredClone` API, which provides a robust and
     * efficient way to deep-clone complex objects, handling circular references
     * and various data types correctly.
     *
     * @returns {Component} A new instance of the component with the same data.
     */
    clone() {
        // structuredClone is a modern, built-in way to perform a deep copy.
        // It's more robust than `JSON.parse(JSON.stringify(this))` as it can
        // handle more data types and circular references.
        return structuredClone(this);
    }
}