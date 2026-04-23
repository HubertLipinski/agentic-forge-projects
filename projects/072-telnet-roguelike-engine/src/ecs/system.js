/**
 * @file src/ecs/system.js
 * @description Base class for all Systems in the ECS architecture.
 */

/**
 * @typedef {import('./world.js').default} World
 */

/**
 * Represents a System in the Entity-Component-System (ECS) architecture.
 *
 * A System contains the logic that operates on entities possessing a specific
 * set of components. Systems are the "behavior" part of ECS, while entities
 * are the "things" and components are their "data".
 *
 * This base class provides a foundational structure. Subclasses should implement
 * the `update` method, which contains the core logic that runs each game tick
 * or frame.
 *
 * The `System` is designed to be tightly coupled with a `World` instance. The
 * `world` property is automatically set when the system is added to a world,
 * giving it access to entities, components, and the ability to create queries.
 *
 * @example
 * // A simple system that makes entities with a 'Velocity' component move.
 * class MovementSystem extends System {
 *   #query;
 *
 *   constructor() {
 *     super();
 *     // The world property is available here because the base constructor
 *     // is called after the world is assigned. However, it's safer to
 *     // define queries in an `onAddedToWorld` method if the system
 *     // needs to be reused across different worlds. For this engine,
 *     // systems are instantiated per world, so the constructor is fine.
 *     this.#query = this.world.createQuery(Position, Velocity);
 *   }
 *
 *   update(deltaTime) {
 *     for (const entity of this.#query.get()) {
 *       const position = entity.get(Position);
 *       const velocity = entity.get(Velocity);
 *       position.x += velocity.dx * deltaTime;
 *       position.y += velocity.dy * deltaTime;
 *     }
 *   }
 * }
 */
export default class System {
    /**
     * A reference to the ECS World that this system belongs to.
     * This property is automatically set by the World when the system is added.
     * It provides access to the world's entities, queries, and event emitter.
     * @type {World | null}
     */
    world = null;

    /**
     * Indicates whether the system is enabled. An inactive system's `update`
     * method will be skipped by the world's update loop.
     * @type {boolean}
     */
    active = true;

    /**
     * Creates an instance of a System.
     * The constructor is intentionally simple. Initialization logic that depends
     * on the `world` (like creating queries) should be placed here, as the `world`
     * property will be assigned before the subclass constructor body executes.
     */
    constructor() {
        // The `world` property is set by the World's `addSystem` method
        // immediately after instantiation and before this constructor returns.
        // This allows subclasses to safely create queries in their own constructors.
    }

    /**
     * The core logic of the system, executed on each tick of the game loop.
     * Subclasses MUST override this method.
     *
     * This method is called by the `World`'s update loop. The arguments passed
     * to it are forwarded from the `world.update()` call, allowing the main
     * game loop to pass in global state like delta time or the game map.
     *
     * @param {...any} args - Arguments passed from the `world.update()` call.
     * @throws {Error} If the method is not implemented by a subclass.
     */
    update(...args) {
        throw new Error(`System '${this.constructor.name}' must implement the 'update' method.`);
    }

    /**
     * A lifecycle hook called when the system is added to a world.
     * This can be used for setup logic that requires a world context.
     * By default, it does nothing. Subclasses can override it if needed.
     */
    onAddedToWorld() {
        // Optional: Can be implemented by subclasses for one-time setup.
    }

    /**
     * A lifecycle hook called when the system is removed from a world.
     * This can be used for cleanup logic.
     * By default, it does nothing. Subclasses can override it if needed.
     */
    onRemovedFromWorld() {
        // Optional: Can be implemented by subclasses for cleanup.
    }
}