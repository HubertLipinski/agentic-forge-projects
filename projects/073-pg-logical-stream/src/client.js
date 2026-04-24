/**
 * src/client.js
 *
 * This module provides the main `PgLogicalStream` client class. It serves as the
 * primary public interface for the library, orchestrating the connection,
 * parsing, and stream handling components to provide a high-level, event-driven
 * API for consuming PostgreSQL logical replication changes.
 *
 * The client is an EventEmitter, emitting discrete events for different database
 * operations like 'insert', 'update', 'delete', as well as lifecycle events like
 * 'connect', 'error', and 'close'.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { EventEmitter } from 'node:events';
import { ReplicationConnection } from './connection.js';
import { StreamHandler } from './stream-handler.js';
import { PgOutputParser } from './parser.js';
import { TypeDeserializer } from './type-deserializer.js';
import { DEFAULTS } from './constants.js';

/**
 * @typedef {object} PgLogicalStreamOptions
 * @property {object} connection - Connection options for `node-postgres`.
 * @property {string} [slotName='pg_logical_streamer_slot'] - The name of the logical replication slot.
 * @property {string} [publicationName='pg_logical_streamer_pub'] - The name of the publication to subscribe to.
 * @property {string} [startLsn='0/0'] - The LSN to start streaming from.
 * @property {number} [keepAliveIntervalMs=10000] - Interval to send keep-alives.
 * @property {number} [flushIntervalMs=10000] - Interval to flush LSN to the server.
 */

/**
 * The main client for subscribing to a PostgreSQL logical replication stream.
 * It connects to a PostgreSQL server, starts replication from a specified slot,
 * parses the incoming `pgoutput` messages, and emits structured events for
 * database changes.
 *
 * @extends EventEmitter
 *
 * @fires PgLogicalStream#connect - Emitted when the connection is successfully established.
 * @fires PgLogicalStream#error - Emitted when a non-recoverable error occurs.
 * @fires PgLogicalStream#close - Emitted when the connection is closed.
 * @fires PgLogicalStream#data - Emitted for every parsed logical replication message.
 * @fires PgLogicalStream#begin - Emitted for a BEGIN message.
 * @fires PgLogicalStream#commit - Emitted for a COMMIT message.
 * @fires PgLogicalStream#relation - Emitted for a Relation message, describing a table schema.
 * @fires PgLogicalStream#insert - Emitted for an INSERT operation.
 * @fires PgLogicalStream#update - Emitted for an UPDATE operation.
 * @fires PgLogicalStream#delete - Emitted for a DELETE operation.
 * @fires PgLogicalStream#truncate - Emitted for a TRUNCATE operation.
 */
export class PgLogicalStream extends EventEmitter {
  /**
   * @private
   * @type {PgLogicalStreamOptions}
   */
  #options;

  /**
   * @private
   * @type {ReplicationConnection}
   */
  #connection;

  /**
   * @private
   * @type {StreamHandler | null}
   */
  #streamHandler = null;

  /**
   * @private
   * @type {PgOutputParser}
   */
  #parser;

  /**
   * @private
   * @type {TypeDeserializer}
   */
  #deserializer;

  /**
   * @private
   * @type {boolean}
   */
  #isStarted = false;

  /**
   * @private
   * @type {boolean}
   */
  #isStopping = false;

  /**
   * Constructs a new PgLogicalStream client.
   *
   * @param {PgLogicalStreamOptions} options - Configuration options for the client.
   */
  constructor(options) {
    super();

    if (!options?.connection) {
      throw new Error('`options.connection` is required.');
    }

    this.#options = {
      slotName: DEFAULTS.SLOT_NAME,
      publicationName: DEFAULTS.PUBLICATION_NAME,
      startLsn: DEFAULTS.START_LSN,
      keepAliveIntervalMs: DEFAULTS.KEEP_ALIVE_INTERVAL_MS,
      flushIntervalMs: DEFAULTS.FLUSH_INTERVAL_MS,
      ...options,
    };

    this.#connection = new ReplicationConnection(this.#options.connection);
    this.#parser = new PgOutputParser();
    this.#deserializer = new TypeDeserializer();
  }

  /**
   * Connects to the PostgreSQL server and starts listening for replication changes.
   *
   * @returns {Promise<void>} A promise that resolves when the client is connected
   *   and streaming, or rejects if an error occurs.
   */
  async start() {
    if (this.#isStarted) {
      console.warn('`start()` called on an already started client. Ignoring.');
      return;
    }
    this.#isStarted = true;
    this.#isStopping = false;

    try {
      const pgClient = await this.#connection.connect(
        this.#options.slotName,
        this.#options.publicationName,
        this.#options.startLsn
      );

      this.#streamHandler = new StreamHandler(
        pgClient,
        (buffer) => this.#processData(buffer),
        {
          startLsn: this.#options.startLsn,
          keepAliveIntervalMs: this.#options.keepAliveIntervalMs,
          flushIntervalMs: this.#options.flushIntervalMs,
        }
      );

      this.#attachClientListeners(pgClient);
      this.#streamHandler.start();

      this.emit('connect');
    } catch (error) {
      this.#isStarted = false;
      const connectError = new Error(`Failed to start replication client: ${error.message}`, { cause: error });
      this.emit('error', connectError);
      // Re-throw to allow caller to handle the failed start.
      throw connectError;
    }
  }

  /**
   * Gracefully disconnects from the PostgreSQL server, ensuring the last
   * received LSN is acknowledged.
   *
   * @returns {Promise<void>} A promise that resolves when the client is fully stopped.
   */
  async stop() {
    if (!this.#isStarted || this.#isStopping) {
      return;
    }
    this.#isStopping = true;

    try {
      if (this.#streamHandler) {
        // Stop timers and perform a final LSN flush.
        await this.#streamHandler.stop();
      }
    } catch (error) {
      this.emit('error', new Error(`Error during stream handler shutdown: ${error.message}`, { cause: error }));
    } finally {
      // Disconnect the underlying pg client.
      await this.#connection.disconnect();
      this.#streamHandler = null;
      this.#isStarted = false;
      this.#isStopping = false;
      // The 'close' event will be fired by the pgClient 'end' listener.
    }
  }

  /**
   * Provides access to the TypeDeserializer instance, allowing users to
   * register custom type parsers.
   *
   * @example
   * client.typeDeserializer.register(12345, (value) => new MyCustomType(value));
   *
   * @returns {TypeDeserializer} The type deserializer instance.
   */
  get typeDeserializer() {
    return this.#deserializer;
  }

  /**
   * @private
   * Attaches event listeners to the underlying `pg.Client` instance to handle
   * errors, notices, and the end of the connection.
   *
   * @param {import('pg').Client} pgClient - The active pg.Client instance.
   */
  #attachClientListeners(pgClient) {
    pgClient.on('error', (err) => {
      // Don't emit errors during a graceful shutdown process.
      if (!this.#isStopping) {
        this.emit('error', new Error(`PostgreSQL connection error: ${err.message}`, { cause: err }));
      }
      // Connection errors are fatal, trigger a stop.
      this.stop().catch(stopErr => console.error('Error during automatic stop after connection error:', stopErr));
    });

    pgClient.on('notice', (notice) => {
      this.emit('notice', notice);
    });

    pgClient.on('end', () => {
      // This event signals that the connection has been terminated.
      this.#isStarted = false;
      this.emit('close');
    });
  }

  /**
   * @private
   * Processes a raw data buffer from the StreamHandler.
   * It parses the buffer into a structured message and emits the corresponding event.
   *
   * @param {Buffer} buffer - The raw `pgoutput` message buffer.
   */
  #processData(buffer) {
    try {
      const message = this.#parser.parse(buffer);
      if (!message) {
        return;
      }

      // Emit a generic 'data' event with the raw parsed message.
      this.emit('data', message);

      // Emit specific, typed events.
      switch (message.tag) {
        case 'insert':
        case 'update':
        case 'delete':
          this.#emitDmlEvent(message);
          break;
        case 'begin':
        case 'commit':
        case 'relation':
        case 'truncate':
          this.emit(message.tag, message);
          break;
        // 'unhandled' messages are valid but not processed; no event emitted.
        case 'unhandled':
          break;
        default:
          console.warn(`Received unknown message tag from parser: ${message.tag}`);
      }
    } catch (error) {
      this.emit('error', new Error(`Error processing replication data: ${error.message}`, { cause: error }));
    }
  }

  /**
   * @private
   * Deserializes tuple data for DML events and emits the final, user-friendly event.
   *
   * @param {object} message - The parsed DML message (insert, update, or delete).
   */
  #emitDmlEvent(message) {
    const enrichedMessage = structuredClone(message);

    if (enrichedMessage.new) {
      enrichedMessage.new = this.#deserializeTuple(enrichedMessage.new, enrichedMessage.columns);
    }
    if (enrichedMessage.old) {
      enrichedMessage.old = this.#deserializeTuple(enrichedMessage.old, enrichedMessage.columns);
    }
    if (enrichedMessage.key) {
      enrichedMessage.key = this.#deserializeTuple(enrichedMessage.key, enrichedMessage.columns);
    }

    // The 'columns' array is redundant in the final event, as data is now keyed by column name.
    delete enrichedMessage.columns;

    this.emit(enrichedMessage.tag, enrichedMessage);
  }

  /**
   * @private
   * Converts a raw tuple (an array of text values) into an object with column
   * names as keys and deserialized JavaScript types as values.
   *
   * @param {Array<string | null>} tupleData - The array of raw string values for the tuple.
   * @param {Array<object>} columnSchemas - The array of column definitions from the Relation message.
   * @returns {object} An object representing the row data.
   */
  #deserializeTuple(tupleData, columnSchemas) {
    const deserialized = {};
    for (let i = 0; i < tupleData.length; i++) {
      const column = columnSchemas[i];
      const rawValue = tupleData[i];
      deserialized[column.name] = this.#deserializer.deserialize(rawValue, column.typeId);
    }
    return deserialized;
  }
}