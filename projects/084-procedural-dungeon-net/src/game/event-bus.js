/**
 * @file src/game/event-bus.js
 * @description A simple, singleton event emitter/subscriber system for decoupling game logic.
 * This module provides a central bus for different parts of the application (e.g., world state,
 * action handlers, network layer) to communicate without being directly coupled. For example,
 * when an actor moves, the WorldState can emit an `actorMoved` event, and the network layer
 * can subscribe to this event to notify relevant clients.
 *
 * This implementation uses a singleton pattern to ensure that all parts of the application
 * share the same event bus instance.
 *
 * @example
 * // In one file (e.g., action-handler.js)
 * import eventBus from './event-bus.js';
 * eventBus.emit('playerAction', { action: 'move', direction: 'north' });
 *
 * // In another file (e.g., a logging service)
 * import eventBus from './event-bus.js';
 * eventBus.on('playerAction', (payload) => {
 *   console.log(`Player performed action: ${payload.action}`);
 * });
 */

/**
 * A simple event bus class that allows for subscribing to events,
 * unsubscribing from events, and emitting events.
 */
class EventBus {
  /**
   * @private
   * @type {Map<string, Set<Function>>}
   */
  #listeners;

  /**
   * Initializes a new EventBus instance.
   * The constructor is private to enforce the singleton pattern.
   * @private
   */
  constructor() {
    /**
     * A map where keys are event names (strings) and values are Sets of
     * listener functions for that event. Using a Set ensures that the same
     * listener function is not added multiple times for the same event.
     */
    this.#listeners = new Map();
  }

  /**
   * Subscribes a listener function to a specific event.
   *
   * @param {string} eventName - The name of the event to subscribe to (e.g., 'actorMoved').
   * @param {Function} listener - The function to be called when the event is emitted.
   *                                This function will receive the payload passed to `emit`.
   * @returns {void}
   */
  on(eventName, listener) {
    if (typeof listener !== 'function') {
      console.error(`[EventBus] Attempted to register a non-function listener for event "${eventName}".`);
      return;
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(listener);
  }

  /**
   * Unsubscribes a listener function from a specific event.
   *
   * @param {string} eventName - The name of the event to unsubscribe from.
   * @param {Function} listener - The specific listener function to remove.
   * @returns {void}
   */
  off(eventName, listener) {
    const eventListeners = this.#listeners.get(eventName);
    if (eventListeners) {
      eventListeners.delete(listener);
      // If no listeners remain for this event, clean up the map entry.
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
    }
  }

  /**
   * Emits an event, calling all subscribed listeners with the provided payload.
   * Listeners are called synchronously in the order they were added.
   *
   * @param {string} eventName - The name of the event to emit.
   * @param {any} [payload] - The data to pass to each listener function.
   *                          It's recommended to pass an object for forward compatibility.
   * @returns {void}
   */
  emit(eventName, payload) {
    const eventListeners = this.#listeners.get(eventName);
    if (eventListeners) {
      // Iterate over a copy of the listeners set. This prevents issues if a listener
      // tries to subscribe or unsubscribe from the same event during its execution.
      const listenersToCall = [...eventListeners];
      for (const listener of listenersToCall) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[EventBus] Error in listener for event "${eventName}":`, error);
          // Continue to the next listener to prevent one faulty listener
          // from stopping the entire event propagation.
        }
      }
    }
  }

  /**
   * Removes all listeners for a specific event, or all listeners for all events
   * if no event name is provided. Useful for cleanup during testing or server shutdown.
   *
   * @param {string} [eventName] - The name of the event to clear listeners for. If omitted, all listeners are cleared.
   * @returns {void}
   */
  clear(eventName) {
    if (eventName) {
      this.#listeners.delete(eventName);
    } else {
      this.#listeners.clear();
    }
  }
}

/**
 * A singleton instance of the EventBus.
 * By exporting a pre-instantiated object, we ensure that any module importing
 * this file will receive the exact same instance, creating a global, shared event bus.
 * @type {EventBus}
 */
const eventBus = new EventBus();

export default eventBus;