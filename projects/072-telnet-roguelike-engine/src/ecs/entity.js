import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * @file src/ecs/entity.js
 * @description Represents an Entity in the Entity-Component-System (ECS) architecture.
 */

/**
 * @typedef {import('./component.js').default} Component
 */

/**
 * An Entity is a general-purpose object in the game world. It is essentially a
 * container for Components, identified by a unique ID.
 *
 * Entities themselves have no data or behavior. They are simply an aggregation
 * of components, which hold the data. The behavior is implemented by Systems
 * that operate on entities with specific sets of components.
 *
 * This class provides methods to add, remove, retrieve, and check for components.
 * It uses a Map for efficient component management, where keys are component class
 * names (e.g., 'Position') and values are the component instances.
 *
 * @example
 * const entity = new Entity();
 * entity.add(new Position(5, 10));
 * entity.add(new Renderable({ glyph: '@', fg: '#FFF' }));
 *
 * if (entity.has(Position)) {
 *   const pos = entity.get(Position);
 *   console.log(`Entity is at (${pos.x}, ${pos.y})`);
 * }
 *
 * entity.remove(Renderable);
 */
export default class Entity {
    /**
     * A unique identifier for the entity.
     * @type {string}
     * @readonly
     */
    id;

    /**
     * A reference to the World this entity belongs to. This allows the entity
     * to notify the world when its component composition changes, which is
     * crucial for keeping system queries up-to-date.
     * @type {import('./world.js').default | null}
     */
    world = null;

    /**
     * A collection of components attached to this entity.
     * The key is the component's class name (a string), and the value is the
     * component instance.
     * @type {Map<string, Component>}
     * @private
     */
    #components = new Map();

    /**
     * Creates an instance of an Entity.
     * @param {string} [id] - A unique identifier. If not provided, a new UUID will be generated.
     */
    constructor(id) {
        this.id = id ?? uuidv4();
    }

    /**
     * Adds a component to the entity.
     * If a component of the same type already exists, it will be overwritten.
     *
     * @param {Component} component - The component instance to add.
     * @returns {this} The entity instance, for method chaining.
     * @throws {Error} If the provided argument is not a valid component instance.
     */
    add(component) {
        // The `name` property is set in the Component base class constructor.
        if (!component || typeof component.name !== 'string') {
            logger.error('Attempted to add an invalid component to entity', this.id, component);
            throw new Error('Invalid component: Must be an instance of a Component subclass.');
        }

        this.#components.set(component.name, component);

        // Notify the world that this entity has changed, so it can update its query caches.
        this.world?.onEntityChanged(this);

        return this;
    }

    /**
     * Removes a component from the entity.
     *
     * @param {string | Function | Component} componentIdentifier - The component to remove.
     *   Can be the component's class name (string), the component class itself,
     *   or a component instance.
     * @returns {boolean} True if a component was removed, false otherwise.
     */
    remove(componentIdentifier) {
        const componentName = this.#getComponentName(componentIdentifier);

        const wasDeleted = this.#components.delete(componentName);

        if (wasDeleted) {
            // Notify the world of the change.
            this.world?.onEntityChanged(this);
        }

        return wasDeleted;
    }

    /**
     * Retrieves a component instance from the entity.
     *
     * @template {Component} T
     * @param {string | { new(...args: any[]): T } | T} componentIdentifier - The component to retrieve.
     *   Can be the component's class name (string) or the component class itself.
     * @returns {T | undefined} The component instance, or undefined if not found.
     */
    get(componentIdentifier) {
        const componentName = this.#getComponentName(componentIdentifier);
        return this.#components.get(componentName);
    }

    /**
     * Checks if the entity has a specific component.
     *
     * @param {string | Function | Component} componentIdentifier - The component to check for.
     *   Can be the component's class name (string), the component class itself,
     *   or a component instance.
     * @returns {boolean} True if the entity has the component, false otherwise.
     */
    has(componentIdentifier) {
        const componentName = this.#getComponentName(componentIdentifier);
        return this.#components.has(componentName);
    }

    /**
     * Checks if the entity has all of the specified components.
     *
     * @param {Array<string | Function | Component>} componentIdentifiers - An array of components to check for.
     * @returns {boolean} True if the entity has all the specified components, false otherwise.
     */
    hasAll(componentIdentifiers) {
        return componentIdentifiers.every(id => this.has(id));
    }

    /**
     * Checks if the entity has at least one of the specified components.
     *
     * @param {Array<string | Function | Component>} componentIdentifiers - An array of components to check for.
     * @returns {boolean} True if the entity has at least one of the specified components, false otherwise.
     */
    hasAny(componentIdentifiers) {
        return componentIdentifiers.some(id => this.has(id));
    }

    /**
     * Removes all components from the entity and notifies the world.
     * This is useful for "destroying" an entity or resetting it.
     */
    clear() {
        if (this.#components.size > 0) {
            this.#components.clear();
            this.world?.onEntityChanged(this);
        }
    }

    /**
     * Returns an iterable of all component instances attached to the entity.
     * @returns {IterableIterator<Component>}
     */
    *getAllComponents() {
        yield* this.#components.values();
    }

    /**
     * A private helper method to consistently resolve a component identifier
     * to its class name string.
     *
     * @private
     * @param {string | Function | Component} identifier - The identifier to resolve.
     * @returns {string} The component's class name.
     * @throws {Error} If the identifier is invalid.
     */
    #getComponentName(identifier) {
        if (typeof identifier === 'string') {
            return identifier;
        }
        if (typeof identifier === 'function') {
            return identifier.name;
        }
        if (identifier && typeof identifier.name === 'string') {
            return identifier.name;
        }
        throw new Error(`Invalid component identifier provided: ${identifier}`);
    }

    /**
     * Provides a string representation of the entity, useful for debugging.
     * @returns {string} A string describing the entity and its components.
     */
    toString() {
        const componentNames = [...this.#components.keys()].join(', ');
        return `Entity(${this.id}) [${componentNames || 'No Components'}]`;
    }
}