import net from 'net';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import TelnetClient from './telnet-client.js';

/**
 * @file src/net/telnet-server.js
 * @description Core Telnet server using Node's 'net' module. Manages connections, disconnections, and data events.
 */

/**
 * Represents the configuration options for the TelnetServer.
 * @typedef {object} TelnetServerOptions
 * @property {number} port - The port number the server should listen on.
 * @property {string} [host='0.0.0.0'] - The host address to bind to. '0.0.0.0' allows connections from any network interface.
 * @property {number} [maxClients=100] - The maximum number of concurrent client connections.
 * @property {string} [welcomeMessage='Welcome to the Telnet Roguelike Engine!'] - A message sent to clients upon connection.
 */

/**
 * The TelnetServer class is responsible for creating and managing a TCP server
 * that handles Telnet client connections. It listens for incoming connections,
 * creates a `TelnetClient` instance for each, and emits events for connection,
 * disconnection, and incoming data.
 *
 * This class extends EventEmitter to provide a decoupled way for the rest of
 * the application to react to network events.
 *
 * Events:
 * - `start`: Emitted when the server successfully starts listening.
 * - `stop`: Emitted when the server has been stopped.
 * - `connection`: Emitted when a new client connects. Passes the `TelnetClient` instance.
 * - `disconnection`: Emitted when a client disconnects. Passes the `TelnetClient` instance.
 * - `error`: Emitted when a server-level error occurs.
 *
 * @extends {EventEmitter}
 */
export default class TelnetServer extends EventEmitter {
    /**
     * The underlying Node.js `net.Server` instance.
     * @type {net.Server | null}
     * @private
     */
    #server = null;

    /**
     * A map of all connected clients, keyed by their unique ID.
     * @type {Map<string, TelnetClient>}
     * @private
     */
    #clients = new Map();

    /**
     * The configuration options for the server.
     * @type {TelnetServerOptions}
     * @private
     */
    #options;

    /**
     * Creates an instance of TelnetServer.
     * @param {TelnetServerOptions} options - The server configuration.
     */
    constructor(options) {
        super();

        if (!options || typeof options.port !== 'number') {
            throw new Error('TelnetServer requires an options object with a numeric port.');
        }

        this.#options = {
            host: '0.0.0.0',
            maxClients: 100,
            welcomeMessage: 'Welcome to the Telnet Roguelike Engine!',
            ...options,
        };

        this.#server = net.createServer();
        this.#setupServerEvents();
    }

    /**
     * Sets up the event listeners for the internal `net.Server` instance.
     * This includes handling new connections, server errors, and the close event.
     * @private
     */
    #setupServerEvents() {
        this.#server.on('connection', this.#handleConnection.bind(this));
        this.#server.on('error', this.#handleServerError.bind(this));
        this.#server.on('close', () => {
            logger.info('[TelnetServer] Server has been stopped.');
            this.emit('stop');
        });
    }

    /**
     * Starts the Telnet server, making it listen for incoming connections on the configured port and host.
     * @returns {Promise<void>} A promise that resolves when the server has successfully started.
     */
    async start() {
        if (this.#server.listening) {
            logger.warn(`[TelnetServer] Server is already running on port ${this.#options.port}.`);
            return;
        }

        return new Promise((resolve, reject) => {
            this.#server.listen(this.#options.port, this.#options.host, () => {
                const address = this.#server.address();
                logger.info(`[TelnetServer] Server started and listening on ${address.address}:${address.port}`);
                this.emit('start', address);
                resolve();
            });

            // The 'error' event listener will handle listen-time errors like EADDRINUSE.
            // We add a one-time listener here to reject the promise specifically for startup failures.
            const startupErrorListener = (err) => {
                this.#server.removeListener('listening', resolve); // Clean up success listener
                reject(err);
            };
            this.#server.once('error', startupErrorListener);
            this.#server.once('listening', () => {
                this.#server.removeListener('error', startupErrorListener); // Clean up error listener on success
            });
        });
    }

    /**
     * Stops the Telnet server, disconnecting all clients and closing the listener.
     * @returns {Promise<void>} A promise that resolves when the server has fully stopped.
     */
    async stop() {
        if (!this.#server.listening) {
            logger.info('[TelnetServer] Server is not running.');
            return;
        }

        return new Promise((resolve) => {
            logger.info('[TelnetServer] Stopping server...');
            // Disconnect all clients gracefully.
            for (const client of this.#clients.values()) {
                client.disconnect('Server is shutting down.');
            }
            this.#clients.clear();

            this.#server.close((err) => {
                if (err) {
                    logger.error('[TelnetServer] Error while stopping server:', err);
                }
                resolve();
            });
        });
    }

    /**
     * Handles a new incoming client connection.
     * @param {net.Socket} socket - The socket object for the new connection.
     * @private
     */
    #handleConnection(socket) {
        if (this.#clients.size >= this.#options.maxClients) {
            logger.warn(`[TelnetServer] Max client limit (${this.#options.maxClients}) reached. Rejecting connection from ${socket.remoteAddress}.`);
            socket.end('Server is full. Please try again later.\n');
            return;
        }

        const clientId = uuidv4();
        const client = new TelnetClient(socket, clientId);
        this.#clients.set(clientId, client);

        logger.info(`[TelnetServer] Client connected: ${client.id} from ${client.remoteAddress}`);

        // Set up listeners for client events
        client.on('disconnect', () => this.#handleDisconnection(client));
        client.on('error', (err) => logger.warn(`[TelnetClient] Error for client ${client.id}:`, err.message));

        // Negotiate Telnet options (e.g., suppress local echo)
        client.negotiate();

        // Send a welcome message
        client.send(this.#options.welcomeMessage + '\n');

        // Emit the 'connection' event for the game logic to handle.
        this.emit('connection', client);
    }

    /**
     * Handles a client disconnection.
     * @param {TelnetClient} client - The client that has disconnected.
     * @private
     */
    #handleDisconnection(client) {
        if (this.#clients.has(client.id)) {
            this.#clients.delete(client.id);
            logger.info(`[TelnetServer] Client disconnected: ${client.id}. Total clients: ${this.#clients.size}`);
            this.emit('disconnection', client);
        }
    }

    /**
     * Handles server-level errors, such as a port being already in use.
     * @param {Error} error - The error object.
     * @private
     */
    #handleServerError(error) {
        if (error.code === 'EADDRINUSE') {
            logger.error(`[TelnetServer] Failed to start: Port ${this.#options.port} is already in use.`);
        } else {
            logger.error('[TelnetServer] An unexpected server error occurred:', error);
        }
        this.emit('error', error);
    }

    /**
     * Broadcasts a message to all connected clients.
     * @param {string} message - The message to send.
     * @param {string} [excludeClientId] - An optional client ID to exclude from the broadcast.
     */
    broadcast(message, excludeClientId) {
        logger.debug(`[TelnetServer] Broadcasting message to ${this.#clients.size} clients.`);
        for (const client of this.#clients.values()) {
            if (client.id !== excludeClientId) {
                client.send(message);
            }
        }
    }

    /**
     * Retrieves a list of all currently connected clients.
     * @returns {TelnetClient[]} An array of TelnetClient instances.
     */
    getClients() {
        return Array.from(this.#clients.values());
    }

    /**
     * Gets the current number of connected clients.
     * @returns {number} The number of clients.
     */
    getClientCount() {
        return this.#clients.size;
    }
}