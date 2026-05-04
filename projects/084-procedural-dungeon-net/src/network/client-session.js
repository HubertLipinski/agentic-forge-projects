/**
 * @file src/network/client-session.js
 * @description Manages the state and communication for a single connected TCP client.
 * Each instance of this class represents one player's connection to the server.
 * It is responsible for handling data from the client's socket, passing commands
 * to the game engine, and sending game updates back to the client.
 */

import { generateId } from '../utils/uuid.js';

/**
 * Represents a single client session, managing the lifecycle of a TCP connection.
 */
export class ClientSession {
  /**
   * A unique identifier for this session.
   * @type {string}
   */
  id;

  /**
   * The underlying TCP socket for this client connection.
   * @type {import('net').Socket}
   */
  socket;

  /**
   * The unique ID of the actor associated with this session (the player character).
   * This is set after the player has been successfully added to the world state.
   * @type {string | null}
   */
  actorId;

  /**
   * A reference to the main server instance.
   * @type {import('./server.js').DungeonServer}
   */
  #server;

  /**
   * A buffer to store incoming data chunks until a complete line can be processed.
   * @type {string}
   */
  #dataBuffer = '';

  /**
   * Creates a new ClientSession.
   *
   * @param {import('net').Socket} socket - The TCP socket for the connected client.
   * @param {import('./server.js').DungeonServer} server - The main server instance.
   */
  constructor(socket, server) {
    this.id = generateId();
    this.socket = socket;
    this.#server = server;
    this.actorId = null;

    this.#initialize();
  }

  /**
   * Sets up event listeners for the socket.
   * @private
   */
  #initialize() {
    this.socket.setEncoding('utf8');

    // Attach event handlers
    this.socket.on('data', (data) => this.#handleData(data));
    this.socket.on('close', () => this.#handleClose());
    this.socket.on('error', (err) => this.#handleError(err));

    console.log(`[Session ${this.id}] New connection from ${this.socket.remoteAddress}:${this.socket.remotePort}`);
  }

  /**
   * Handles incoming data from the client's socket.
   * It buffers data and processes it line by line.
   *
   * @param {Buffer | string} data - The data received from the socket.
   * @private
   */
  #handleData(data) {
    this.#dataBuffer += data.toString();

    // Process all complete lines (ending with '\n') in the buffer.
    let newlineIndex;
    while ((newlineIndex = this.#dataBuffer.indexOf('\n')) !== -1) {
      const line = this.#dataBuffer.substring(0, newlineIndex).trim();
      this.#dataBuffer = this.#dataBuffer.substring(newlineIndex + 1);

      if (line.length > 0) {
        // Enqueue the command for processing by the game engine.
        // This decouples network I/O from game logic execution.
        this.#server.enqueueCommand(this.id, line);
      }
    }
  }

  /**
   * Handles the socket 'close' event.
   * This is triggered when the client disconnects.
   * @private
   */
  #handleClose() {
    console.log(`[Session ${this.id}] Connection closed.`);
    this.#server.removeSession(this.id);
  }

  /**
   * Handles socket errors.
   *
   * @param {Error} err - The error object.
   * @private
   */
  #handleError(err) {
    // 'ECONNRESET' is a common error when a client disconnects abruptly.
    // It's safe to ignore it as a non-critical event.
    if (err.code === 'ECONNRESET') {
      console.log(`[Session ${this.id}] Connection reset by peer.`);
    } else {
      console.error(`[Session ${this.id}] Socket error:`, err);
    }
    // The 'close' event will be fired automatically after an error,
    // so cleanup is handled in #handleClose.
  }

  /**
   * Sends a message to the client.
   * Appends a newline character to ensure the client can read it as a complete line.
   *
   * @param {string} message - The message to send.
   */
  send(message) {
    if (this.socket.writable) {
      try {
        this.socket.write(message + '\n');
      } catch (error) {
        console.error(`[Session ${this.id}] Failed to write to socket:`, error);
        this.close();
      }
    }
  }

  /**
   * Sends a structured object to the client as a JSON string.
   * This is useful for sending complex game state information.
   *
   * @param {object} data - The serializable object to send.
   */
  sendJson(data) {
    try {
      const jsonString = JSON.stringify(data);
      this.send(jsonString);
    } catch (error) {
      console.error(`[Session ${this.id}] Failed to serialize JSON for sending:`, error);
    }
  }

  /**
   * Gracefully closes the client's connection.
   */
  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.end(); // Signals the end of the write stream, 'close' event will follow.
    }
  }

  /**
   * Gets the remote address of the connected client.
   * @returns {string} The IP address and port of the client.
   */
  get remoteAddress() {
    return `${this.socket.remoteAddress}:${this.socket.remotePort}`;
  }
}