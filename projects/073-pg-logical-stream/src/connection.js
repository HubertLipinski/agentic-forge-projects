/**
 * src/connection.js
 *
 * This module manages the low-level replication connection to PostgreSQL using
 * the 'pg' library. It handles the initial handshake, authentication, and
 * the specific protocol startup sequence required for logical replication.
 *
 * It provides a clean `connect` method that abstracts away the complexity of
 * the replication protocol startup, returning a ready-to-use `pg.Client`
 * instance that is already in replication mode.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import pg from 'pg';

/**
 * Manages the low-level connection and replication protocol startup.
 * This class encapsulates the specific steps needed to establish a
 * logical replication connection with a PostgreSQL server.
 */
export class ReplicationConnection {
  /**
   * @private
   * @type {pg.Client | null}
   * The underlying 'pg' client instance.
   */
  #client = null;

  /**
   * @private
   * @type {object}
   * The connection options for the PostgreSQL server.
   */
  #connectionOptions;

  /**
   * Constructs a ReplicationConnection instance.
   *
   * @param {object} connectionOptions - Connection options compatible with `node-postgres` (pg).
   * @see https://node-postgres.com/features/connecting
   */
  constructor(connectionOptions) {
    if (!connectionOptions || typeof connectionOptions !== 'object') {
      throw new Error('`connectionOptions` must be a valid object.');
    }
    this.#connectionOptions = connectionOptions;
  }

  /**
   * Establishes a connection to the PostgreSQL server and initiates the
   * logical replication protocol.
   *
   * This method performs the following steps:
   * 1. Creates a new `pg.Client` with replication-specific parameters.
   * 2. Connects to the database.
   * 3. Sends the `IDENTIFY_SYSTEM` command to verify the server state.
   * 4. Sends the `START_REPLICATION` command to begin streaming changes.
   *
   * @param {string} slotName - The name of the logical replication slot to use.
   * @param {string} publicationName - The name of the publication to subscribe to.
   * @param {string} startLsn - The Log Sequence Number (LSN) to start streaming from.
   * @returns {Promise<pg.Client>} A promise that resolves with the configured `pg.Client`
   *   instance, ready for receiving replication messages.
   * @throws {Error} if connection or replication startup fails.
   */
  async connect(slotName, publicationName, startLsn) {
    if (this.#client) {
      console.warn('Attempted to connect while already connected. Disconnecting first.');
      await this.disconnect();
    }

    // The `replication` mode is the key parameter that tells `node-postgres`
    // to enter the replication protocol instead of the standard query protocol.
    const replicationClientOptions = {
      ...this.#connectionOptions,
      replication: 'database',
    };

    this.#client = new pg.Client(replicationClientOptions);

    try {
      await this.#client.connect();

      // Step 1: Verify server identity. This is a required part of the replication handshake.
      // It also returns the current LSN, which can be useful for diagnostics.
      await this.#identifySystem();

      // Step 2: Start the logical replication stream from the specified slot and LSN.
      // The `pgoutput` plugin is specified here, along with the publication name.
      const query = `START_REPLICATION SLOT "${slotName}" LOGICAL ${startLsn} (proto_version '1', publication_names '${publicationName}')`;
      await this.#client.query(query);

      return this.#client;
    } catch (error) {
      // Ensure the client is cleaned up on a failed connection attempt.
      await this.disconnect();
      // Re-throw a more informative error for the consumer.
      throw new Error(`Failed to start logical replication: ${error.message}`, { cause: error });
    }
  }

  /**
   * Gracefully disconnects from the PostgreSQL server.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.#client) {
      try {
        await this.#client.end();
      } catch (error) {
        // Log error but don't prevent client from being nulled.
        // This can happen if the connection was already terminated uncleanly.
        console.error('Error during client disconnection:', error.message);
      } finally {
        this.#client = null;
      }
    }
  }

  /**
   * Checks if the client is currently connected.
   *
   * @returns {boolean} `true` if connected, `false` otherwise.
   */
  isConnected() {
    // The `_connected` property is an internal flag in `node-postgres`
    // that accurately reflects the connection state.
    return this.#client?._connected === true;
  }

  /**
   * @private
   * Executes the `IDENTIFY_SYSTEM` command as part of the replication handshake.
   * This command is used to get information about the server, such as its
   * system ID, timeline, and current LSN. It's a necessary prerequisite
   * before starting the replication stream.
   *
   * @returns {Promise<pg.QueryResult>} The result of the query.
   * @throws {Error} if the query fails.
   */
  async #identifySystem() {
    if (!this.#client) {
      throw new Error('Cannot identify system: client is not initialized.');
    }
    try {
      const result = await this.#client.query('IDENTIFY_SYSTEM');
      // The result contains valuable info, but for our purposes, we just need
      // to ensure the command succeeds. We can log it for debugging if needed.
      // console.debug('IDENTIFY_SYSTEM successful:', result.rows[0]);
      return result;
    } catch (error) {
      throw new Error(`IDENTIFY_SYSTEM command failed: ${error.message}`, { cause: error });
    }
  }
}