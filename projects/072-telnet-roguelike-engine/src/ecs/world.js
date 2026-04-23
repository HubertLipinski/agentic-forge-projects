/**
 * @file src/ecs/world.js
 * @description The main ECS container. Manages entities, components, and systems, and runs the system update loop.
 * This file is the heart of the Entity-Component-System (ECS) architecture for the engine.
 */

import { EventEmitter } from 'events';
import Entity from './entity.js';
import System from './system.js';
import logger from '../utils/logger.js';

/**
 * Represents a collection of entities that match a specific set of components.
 * Queries are a performance optimization. Instead of searching all entities for
 * a component combination on every system update, the World maintains cached
 * lists of entities for each query. These lists are updated only when an entity's
 * component composition changes.
 */
class Query {
    /**
     * @type {World}
     * @private
     */
    #world;

    /**
     * The list of component names this query matches against.
     * @type {string[]}
     * @private
     */
    #componentNames;

    /**
     * The cached list of entities that match the query.
     * @type {Entity[]}
     * @private
     */
    #entities = [];

    /**
     * Creates an instance of Query.
     * @param {World} world - The world this query belongs to.
     * @param {string[]} componentNames - The component names to match.
     */
    constructor(world, componentNames) {
        this.#world = world;
        this.#componentNames = componentNames;
        this.rebuild(); // Initial population
    }

    /**
     * Checks if an entity matches the query's component requirements.
     * @param {Entity} entity - The entity to check.
     * @returns {boolean} - True if the entity matches, false otherwise.
     */
    matches(entity) {
        return entity.hasAll(this.#componentNames);
    }

    /**
     * Forces a full rebuild of the query's cached entity list.
     * This iterates over all entities in the world.
     */
    rebuild() {
        this.#entities = [];
        for (const entity of this.#world.getAllEntities()) {
            if (this.matches(entity)) {
                this.#entities.push(entity);
            }
        }
    }

    /**
     * Adds an entity to the query cache if it matches.
     * @param {Entity} entity - The entity to add.
     */
    add(entity) {
        if (this.matches(entity) && !this.#entities.includes(entity)) {
            this.#entities.push(entity);
        }
    }

    /**
     * Removes an entity from the query cache.
     * @param {Entity} entity - The entity to remove.
     */
    remove(entity) {
        const index = this.#entities.indexOf(entity);
        if (index !== -1) {
            this.#entities.splice(index, 1);
        }
    }

    /**
     * Returns the cached list of entities matching this query.
     * @returns {Entity[]} - The array of matching entities.
     */
    get() {
        return this.#entities;
    }
}

/**
 * The World is the central container for all ECS elements. It manages the
 * lifecycle of entities, components, and systems. It also provides an event
 * bus for decoupled communication between different parts of the game logic.
 *
 * It extends Node.js's `EventEmitter` to allow systems and other game logic
 * to subscribe to and emit events (e.g., 'player-death', 'message').
 */
export default class World extends EventEmitter {
    /**
     * A map of all entities in the world, keyed by their unique ID.
     * @type {Map<string, Entity>}
     * @private
     */
    #entities = new Map();

    /**
     * A list of all systems registered with the world.
     * The order of this list determines the execution order during the update loop.
     * @type {System[]}
     * @private
     */
    #systems = [];

    /**
     * A map of registered queries, keyed by a unique string derived from
     * the component names they match. This prevents creating duplicate queries.
     * @type {Map<string, Query>}
     * @private
     */
    #queries = new Map();

    /**
     * Creates an instance of World.
     */
    constructor() {
        super();
        // Increase the max listeners to accommodate potentially many systems
        // listening to world events. The default is 10.
        this.setMaxListeners(100);
    }

    /**
     * Creates a new entity, adds it to the world, and returns it.
     * @param {string} [id] - An optional unique ID for the entity. If not provided, a UUID will be generated.
     * @returns {Entity} The newly created entity.
     */
    createEntity(id) {
        const entity = new Entity(id);
        entity.world = this;
        this.#entities.set(entity.id, entity);
        logger.debug(`[World] Created entity ${entity.id}`);
        return entity;
    }

    /**
     * Removes an entity and all its components from the world.
     * @param {string | Entity} entityIdentifier - The ID of the entity or the entity instance itself.
     * @returns {boolean} True if the entity was found and removed, false otherwise.
     */
    removeEntity(entityIdentifier) {
        const entityId = typeof entityIdentifier === 'string' ? entityIdentifier : entityIdentifier?.id;
        const entity = this.#entities.get(entityId);

        if (!entity) {
            logger.warn(`[World] Attempted to remove non-existent entity with ID: ${entityId}`);
            return false;
        }

        // Notify systems and queries that this entity is being removed.
        this.onEntityChanged(entity);
        entity.clear(); // This will trigger onEntityChanged again, but it's safe.

        this.#entities.delete(entityId);
        entity.world = null;
        logger.debug(`[World] Removed entity ${entityId}`);
        return true;
    }

    /**
     * Retrieves an entity by its ID.
     * @param {string} entityId - The unique ID of the entity.
     * @returns {Entity | undefined} The entity instance, or undefined if not found.
     */
    getEntity(entityId) {
        return this.#entities.get(entityId);
    }

    /**
     * Returns an iterable of all entities currently in the world.
     * @returns {IterableIterator<Entity>}
     */
    getAllEntities() {
        return this.#entities.values();
    }

    /**
     * Adds a system to the world. The system's `world` property will be set,
     * and its `onAddedToWorld` lifecycle method will be called.
     * @param {System} system - The system instance to add.
     * @returns {this} The world instance for method chaining.
     */
    addSystem(system) {
        if (!(system instanceof System)) {
            throw new Error('Can only add instances of a System subclass.');
        }
        system.world = this;
        this.#systems.push(system);
        system.onAddedToWorld();
        logger.info(`[World] Added system: ${system.constructor.name}`);
        return this;
    }

    /**
     * Removes a system from the world.
     * @param {System} system - The system instance to remove.
     */
    removeSystem(system) {
        const index = this.#systems.indexOf(system);
        if (index !== -1) {
            this.#systems.splice(index, 1);
            system.onRemovedFromWorld();
            system.world = null;
            logger.info(`[World] Removed system: ${system.constructor.name}`);
        }
    }

    /**
     * Creates and registers a new query for a set of components.
     * If an identical query already exists, the existing one is returned to
     * avoid redundant work.
     * @param {...(string | Function)} componentIdentifiers - The component classes or names to query for.
     * @returns {Query} The new or existing query instance.
     */
    createQuery(...componentIdentifiers) {
        const componentNames = componentIdentifiers.map(id => (typeof id === 'function' ? id.name : id)).sort();
        const queryKey = componentNames.join('-');

        if (this.#queries.has(queryKey)) {
            return this.#queries.get(queryKey);
        }

        const newQuery = new Query(this, componentNames);
        this.#queries.set(queryKey, newQuery);
        logger.debug(`[World] Created new query for components: [${componentNames.join(', ')}]`);
        return newQuery;
    }

    /**
     * Executes the `update` method for all active systems in the order they were added.
     * Any arguments passed to this method will be forwarded to each system's `update` method.
     * @param {...any} args - Arguments to pass to each system's update method (e.g., deltaTime, gameMap).
     */
    update(...args) {
        for (const system of this.#systems) {
            if (system.active) {
                try {
                    system.update(this, ...args);
                } catch (error) {
                    logger.error(`[World] Error in system '${system.constructor.name}':`, error);
                    // Depending on desired behavior, we could disable the system:
                    // system.active = false;
                }
            }
        }
    }

    /**
     * A callback method invoked by an Entity when its components are modified.
     * This method ensures that all relevant queries are updated to reflect the change.
     * @param {Entity} entity - The entity that has changed.
     */
    onEntityChanged(entity) {
        for (const query of this.#queries.values()) {
            // A simple approach is to check if the entity's new state matches the query.
            // This handles both addition and removal from the query's cache.
            const isCurrentlyIn = query.get().includes(entity);
            const shouldBeIn = query.matches(entity);

            if (isCurrentlyIn && !shouldBeIn) {
                query.remove(entity);
            } else if (!isCurrentlyIn && shouldBeIn) {
                query.add(entity);
            }
        }
    }
}