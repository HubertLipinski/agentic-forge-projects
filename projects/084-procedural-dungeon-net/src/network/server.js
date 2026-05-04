/**
 * @file src/network/server.js
 * @description The main TCP server that listens for connections and manages client sessions.
 * This module is responsible for initializing the Node.js `net` server, handling
 * new client connections, and managing the lifecycle of `ClientSession` objects.
 * It acts as the primary network entry point for the game engine.
 */

import net from 'net';
import { generateId } from '../utils/uuid.js';
import { ClientSession } from './client-session.js';

/**
 * Manages the TCP server, client connections, and session lifecycle.
 */
export class DungeonServer {
  /**
   * The underlying Node.js TCP server instance.
   * @private
   * @type {net.Server | null}
   */
  #server = null;

  /**
   * The port the server is configured to listen on.
   * @private
   * @type {number}
   */
  #port;

  /**
   * The host the server is configured to listen on.
   * @private
   * @type {string}
   */
  #host;

  /**
   * A reference to the game engine, used to pass to new client sessions.
   * @private
   * @type {import('../game/engine.js').GameEngine}
   */
  #engine;

  /**
   * A map of all active client sessions, keyed by their unique session ID.
   * @private
   * @type {Map<string, ClientSession>}
   */
  #sessions = new Map();

  /**
   * Creates an instance of the DungeonServer.
   *
   * @param {object} options - Configuration options for the server.
   * @param {import('../game/engine.js').GameEngine} options.engine - The game engine instance.
   * @param {number} options.port - The port to listen on.
   * @param {string} options.host - The host to bind to.
   */
  constructor({ engine, port, host }) {
    if (!engine) {
      throw new Error('DungeonServer requires a valid game engine instance.');
    }
    if (!port || typeof port !== 'number' || port <= 0) {
      throw new Error('DungeonServer requires a valid, positive port number.');
    }
    if (!host || typeof host !== 'string') {
      throw new Error('DungeonServer requires a valid host string.');
    }

    this.#engine = engine;
    this.#port = port;
    this.#host = host;

    this.#server = net.createServer(this.#handleConnection.bind(this));
    this.#setupEventHandlers();
  }

  /**
   * Sets up the necessary event handlers for the TCP server instance.
   * @private
   */
  #setupEventHandlers() {
    this.#server.on('error', (err) => {
      console.error('TCP Server Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${this.#port} is already in use. Please choose a different port.`);
        // In a production scenario, we might want to exit or retry.
        // For this project, logging the error is sufficient.
      }
    });

    this.#server.on('close', () => {
      console.log('TCP Server has been closed.');
    });
  }

  /**
   * Starts the TCP server and begins listening for incoming connections.
   *
   * @returns {Promise<void>} A promise that resolves when the server is successfully listening.
   */
  start() {
    return new Promise((resolve, reject) => {
      // Attach a one-time listener for the 'listening' event to resolve the promise.
      this.#server.once('listening', () => {
        console.log(`DungeonNet server listening on ${this.#host}:${this.#port}`);
        resolve();
      });

      // Attach a one-time listener for the 'error' event to reject the promise on startup failure.
      this.#server.once('error', (err) => {
        reject(err);
      });

      this.#server.listen(this.#port, this.#host);
    });
  }

  /**
   * Stops the TCP server, gracefully disconnecting all clients.
   *
   * @returns {Promise<void>} A promise that resolves when the server and all connections are closed.
   */
  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.#server || !this.#server.listening) {
        console.log('Server is not running.');
        return resolve();
      }

      console.log('Stopping server. Disconnecting clients...');

      // Disconnect all active sessions.
      for (const session of this.#sessions.values()) {
        session.end('Server is shutting down.');
      }
      this.#sessions.clear();

      this.#server.close((err) => {
        if (err) {
          console.error('Error while closing server:', err);
          return reject(err);
        }
        console.log('Server stopped successfully.');
        resolve();
      });
    });
  }

  /**
   * Handles a new incoming client connection.
   * Creates a new ClientSession for the connection and adds it to the session map.
   *
   * @private
   * @param {net.Socket} socket - The socket object for the new connection.
   */
  #handleConnection(socket) {
    const sessionId = generateId();
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`New connection from ${remoteAddress} (Session ID: ${sessionId})`);

    const session = new ClientSession({
      id: sessionId,
      socket,
      engine: this.#engine,
    });

    this.#sessions.set(sessionId, session);

    // Set up a listener to clean up the session when it ends.
    session.on('end', () => {
      this.#sessions.delete(sessionId);
      console.log(`Session ${sessionId} ended for ${remoteAddress}. Active sessions: ${this.#sessions.size}`);
    });

    // Start the session's lifecycle.
    session.start();
  }

  /**
   * Broadcasts a message to all connected clients.
   *
   * @param {string} message - The message to send.
   * @param {string} [excludeSessionId] - An optional session ID to exclude from the broadcast.
   */
  broadcast(message, excludeSessionId) {
    if (typeof message !== 'string') {
      console.warn('Broadcast ignored: message must be a string.');
      return;
    }

    console.log(`Broadcasting message to ${this.#sessions.size} clients.`);
    for (const session of this.#sessions.values()) {
      if (session.id !== excludeSessionId) {
        session.send(message);
      }
    }
  }

  /**
   * Retrieves the number of currently active client sessions.
   *
   * @returns {number} The number of active sessions.
   */
  getActiveSessionCount() {
    return this.#sessions.size;
  }
}