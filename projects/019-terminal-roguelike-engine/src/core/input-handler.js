/**
 * @file src/core/input-handler.js
 * @description Listens for and processes raw keypress events from `process.stdin` to translate them into game actions.
 *
 * This module is responsible for capturing low-level keyboard input from the
 * terminal and mapping it to high-level, game-specific actions like "move" or
 * "quit". It uses an event-driven approach, emitting 'action' events that the
 * GameLoop can listen for. This decouples the raw input mechanism from the
 * game's core logic.
 */

import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';

/**
 * Handles raw keyboard input from the terminal.
 *
 * It sets up `process.stdin` to read keypresses one by one, without waiting for
 * the user to press Enter. It then translates these keypresses into meaningful
 * game actions and emits them as events.
 *
 * @extends EventEmitter
 */
export class InputHandler extends EventEmitter {
  /**
   * @private
   * @type {boolean}
   * A flag to indicate if the handler is currently listening for input.
   */
  #isListening = false;

  /**
   * @private
   * @type {NodeJS.ReadStream & {fd: 0}}
   * A reference to the standard input stream.
   */
  #stdin;

  /**
   * @private
   * @type {Function | null}
   * The bound listener function for keypress events. Stored for later removal.
   */
  #keyPressListener = null;

  /**
   * Initializes a new InputHandler instance.
   */
  constructor() {
    super();
    this.#stdin = process.stdin;
  }

  /**
   * Starts listening for keyboard input.
   * This method puts the terminal into "raw mode", allowing individual
   * keypresses to be captured.
   */
  start() {
    if (this.#isListening) {
      return;
    }

    // `setRawMode` is essential for capturing keys like arrows, Ctrl+C, etc.,
    // without the OS's line-buffering.
    if (this.#stdin.isTTY) {
      this.#stdin.setRawMode(true);
    } else {
      console.warn('[InputHandler] Standard input is not a TTY. Raw mode could not be set. Input may not work as expected.');
    }

    // Use the 'readline' module to create an interface for keypress events.
    // This is a robust way to handle cross-platform differences in key codes.
    readline.emitKeypressEvents(this.#stdin);

    // The listener function is bound to `this` to ensure the correct context.
    this.#keyPressListener = this.#handleKeyPress.bind(this);
    this.#stdin.on('keypress', this.#keyPressListener);

    this.#isListening = true;
  }

  /**
   * Stops listening for keyboard input.
   * This method restores the terminal to its normal mode. It's crucial to call
   * this on game exit to avoid leaving the user's terminal in a broken state.
   */
  stop() {
    if (!this.#isListening) {
      return;
    }

    if (this.#keyPressListener) {
      this.#stdin.removeListener('keypress', this.#keyPressListener);
      this.#keyPressListener = null;
    }

    if (this.#stdin.isTTY) {
      this.#stdin.setRawMode(false);
    }

    this.#isListening = false;
  }

  /**
   * @private
   * The core event handler for 'keypress' events from `process.stdin`.
   * It translates a raw keypress into a structured game action.
   *
   * @param {string | undefined} str - The string representation of the key (e.g., 'a', '1').
   * @param {object} key - An object describing the key press.
   * @param {string} [key.name] - The name of the key (e.g., 'up', 'c', 'escape').
   * @param {boolean} [key.ctrl] - True if the Ctrl key was held down.
   * @param {boolean} [key.meta] - True if the Meta key was held down (e.g., Cmd on macOS).
   * @param {boolean} [key.shift] - True if the Shift key was held down.
   */
  #handleKeyPress(str, key) {
    if (!this.#isListening) return;

    // Gracefully handle Ctrl+C to exit the process, which is standard terminal behavior.
    // Without this, Ctrl+C would be captured as a normal keypress.
    if (key.ctrl && key.name === 'c') {
      this.emit('action', { type: 'quit' });
      // We let the game loop handle the shutdown, but as a fallback:
      // process.exit();
      return;
    }

    // Map keys to actions. This is where game-specific controls are defined.
    // This could be made configurable in a more advanced implementation.
    let action = null;

    // Movement keys (Arrow keys, Vi keys, Numpad)
    switch (key.name) {
      case 'up':
      case 'k':
      case '8':
        action = { type: 'move', payload: { dx: 0, dy: -1 } };
        break;
      case 'down':
      case 'j':
      case '2':
        action = { type: 'move', payload: { dx: 0, dy: 1 } };
        break;
      case 'left':
      case 'h':
      case '4':
        action = { type: 'move', payload: { dx: -1, dy: 0 } };
        break;
      case 'right':
      case 'l':
      case '6':
        action = { type: 'move', payload: { dx: 1, dy: 0 } };
        break;
      // Diagonal movement
      case 'y':
      case '7':
        action = { type: 'move', payload: { dx: -1, dy: -1 } };
        break;
      case 'u':
      case '9':
        action = { type: 'move', payload: { dx: 1, dy: -1 } };
        break;
      case 'b':
      case '1':
        action = { type: 'move', payload: { dx: -1, dy: 1 } };
        break;
      case 'n':
      case '3':
        action = { type: 'move', payload: { dx: 1, dy: 1 } };
        break;
      
      // Other actions
      case 'g':
        action = { type: 'pickup' };
        break;
      case 'i':
        action = { type: 'inventory' };
        break;
      case '.':
      case '5':
        action = { type: 'wait' };
        break;
      case 'escape':
        action = { type: 'quit' };
        break;
      
      // Add more key mappings here as needed, e.g., for spells, items, etc.
    }

    // If a valid action was determined, emit it for the game loop to process.
    if (action) {
      this.emit('action', action);
    }
  }
}