/**
 * @file src/sources/tcp-source.js
 * @description Implements a log source that creates a TCP server to listen for incoming log lines.
 *
 * This class sets up a TCP server on a specified port. It handles multiple
 * concurrent client connections, processing each line of data received as a
 * separate log entry. It's designed to be resilient, managing connection
 * lifecycles and handling network errors gracefully.
 */

import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { BaseSource } from './base-source.js';

/**
 * @class TcpSource
 * @extends BaseSource
 * @description A log source that listens for log entries over a TCP connection.
 */
export class TcpSource extends BaseSource {
  /**
   * The TCP server instance.
   * @type {import('net').Server | null}
   * @private
   */
  _server = null;

  /**
   * The port number the server will listen on.
   * @type {number}
   * @private
   */
  _port;

  /**
   * A set to keep track of all active client sockets for graceful shutdown.
   * @type {Set<import('net').Socket>}
   * @private
   */
  _sockets = new Set();

  /**
   * Creates an instance of TcpSource.
   * @param {number} port - The TCP port to listen on.
   * @param {import('pino').Logger} logger - The pino logger instance for internal logging.
   */
  constructor(port, logger) {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error('A valid TCP port (1-65535) must be provided.');
    }
    const identifier = `tcp:${port}`;
    super(identifier, logger);
    this._port = port;
  }

  /**
   * Starts the TCP server and begins listening for connections.
   * @override
   * @returns {Promise<void>} A promise that resolves when the server is listening.
   */
  async start() {
    if (this._state !== 'idle') {
      this._logger.warn(`Attempted to start source in non-idle state: ${this._state}`);
      return;
    }

    this._state = 'opening';
    this._logger.info(`Starting TCP server on port ${this._port}...`);

    return new Promise((resolve, reject) => {
      this._server = createServer();

      this._server.on('connection', this._handleConnection.bind(this));

      this._server.on('error', (error) => {
        this._handleError(error, 'server operation');
        // If the server is still in the 'opening' state, this is a fatal startup error.
        if (this._state === 'opening') {
          this._state = 'idle';
          reject(new Error(`Failed to start TCP server on port ${this._port}: ${error.message}`, { cause: error }));
        }
      });

      this._server.listen(this._port, () => {
        this._state = 'open';
        this.emit('open');
        this._logger.info(`TCP server listening on port ${this._port}`);
        resolve();
      });
    });
  }

  /**
   * Stops the TCP server and closes all active client connections.
   * @override
   * @returns {Promise<void>} A promise that resolves when the server and all connections are closed.
   */
  async close() {
    if (this._state !== 'open') {
      this._logger.warn(`Attempted to close source in non-open state: ${this._state}`);
      return;
    }

    this._state = 'closing';
    this._logger.info(`Closing TCP server on port ${this._port}...`);

    // Destroy all active sockets to ensure a quick shutdown.
    for (const socket of this._sockets) {
      socket.destroy();
    }
    this._sockets.clear();

    return new Promise((resolve, reject) => {
      if (!this._server) {
        this._state = 'closed';
        this.emit('close');
        resolve();
        return;
      }

      this._server.close((err) => {
        if (err) {
          // This error is unlikely but should be logged if it occurs.
          // We don't reject the promise as the goal is to shut down, and we should proceed.
          this._handleError(err, 'closing server');
        }
        this._server = null;
        this._state = 'closed';
        this.emit('close');
        this._logger.info(`TCP server on port ${this._port} has been closed.`);
        resolve();
      });
    });
  }

  /**
   * Handles a new client connection to the TCP server.
   * @param {import('net').Socket} socket - The client socket object.
   * @private
   */
  _handleConnection(socket) {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    this._logger.info({ client: remoteAddress }, `New client connected`);

    this._sockets.add(socket);

    // Use readline to handle incoming data stream and split it by lines.
    // This correctly handles partial data chunks.
    const rl = createInterface({
      input: socket,
      crlfDelay: Infinity, // Recognize all newline characters (\n, \r, \r\n).
    });

    rl.on('line', (line) => {
      this._processLine(line);
    });

    socket.on('error', (error) => {
      this._logger.error({ client: remoteAddress, err: error }, 'Socket error');
    });

    socket.on('close', () => {
      this._logger.info({ client: remoteAddress }, `Client disconnected`);
      this._sockets.delete(socket);
      rl.close(); // Clean up the readline interface.
    });

    // Set a timeout to prevent idle connections from lingering indefinitely.
    socket.setTimeout(3_600_000); // 1 hour
    socket.on('timeout', () => {
      this._logger.warn({ client: remoteAddress }, 'Closing idle client connection due to timeout');
      socket.end(); // Gracefully end the connection.
    });
  }
}