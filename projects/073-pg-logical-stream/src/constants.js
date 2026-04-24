/**
 * src/constants.js
 *
 * This module defines constant values used throughout the PostgreSQL logical
 * replication streamer. It centralizes protocol-specific identifiers, default
 * configuration values, and other static data to ensure consistency and ease
 * of maintenance.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

/**
 * PostgreSQL Backend Protocol Message Types
 * These are single-byte identifiers for messages sent from the PostgreSQL backend.
 * @see https://www.postgresql.org/docs/current/protocol-message-formats.html
 */
export const PG_BACKEND_MESSAGE_CODES = Object.freeze({
  AuthenticationOk: 'R',
  BackendKeyData: 'K',
  CommandComplete: 'C',
  CopyData: 'd',
  CopyDone: 'c',
  DataRow: 'D',
  ErrorResponse: 'E',
  NoticeResponse: 'N',
  ParameterStatus: 'S',
  ReadyForQuery: 'Z',
});

/**
 * PostgreSQL Frontend Protocol Message Types
 * These are single-byte identifiers for messages sent from the client to the PostgreSQL frontend.
 * @see https://www.postgresql.org/docs/current/protocol-message-formats.html
 */
export const PG_FRONTEND_MESSAGE_CODES = Object.freeze({
  CopyFail: 'f',
  PasswordMessage: 'p',
  Query: 'Q',
  Terminate: 'X',
});

/**
 * Logical Replication Protocol Message Types (pgoutput)
 * These are single-byte identifiers for messages within a CopyData message
 * when using the pgoutput logical decoding plugin.
 * @see https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html
 */
export const PG_OUTPUT_MESSAGE_CODES = Object.freeze({
  Begin: 'B',
  Commit: 'C',
  Insert: 'I',
  Update: 'U',
  Delete: 'D',
  Truncate: 'T',
  Relation: 'R',
  Type: 'Y',
  Origin: 'O',
  LogicalDecodingMessage: 'M',
});

/**
 * WAL (Write-Ahead Log) Message Types
 * These are single-byte identifiers for messages that are part of the
 * primary WAL stream, distinct from the pgoutput logical messages.
 */
export const WAL_MESSAGE_CODES = Object.freeze({
  // Primary keep-alive message
  PrimaryKeepAlive: 'k',
  // Write-Ahead Log data
  XLogData: 'w',
});

/**
 * Default configuration values for the PgLogicalStream client.
 * These values are used when no overrides are provided by the user.
 */
export const DEFAULTS = Object.freeze({
  /**
   * The default PostgreSQL port.
   */
  PG_PORT: 5432,

  /**
   * The default LSN to start streaming from if none is provided.
   * '0/0' represents the beginning of the log.
   */
  START_LSN: '0/0',

  /**
   * The default name for the replication slot.
   * It's highly recommended that users provide a unique, meaningful name.
   */
  SLOT_NAME: 'pg_logical_streamer_slot',

  /**
   * The default name for the publication.
   * This publication must be created on the PostgreSQL server.
   */
  PUBLICATION_NAME: 'pg_logical_streamer_pub',

  /**
   * The interval (in milliseconds) for sending keep-alive messages to the server
   * to prevent connection timeouts. Set to 0 to disable.
   */
  KEEP_ALIVE_INTERVAL_MS: 10000,

  /**
   * The interval (in milliseconds) for automatically flushing the received LSN
   * back to the server. This acknowledges that the client has processed the WAL
   * up to that point. Set to 0 to disable automatic flushing.
   */
  FLUSH_INTERVAL_MS: 10000,
});

/**
 * Tuple kinds for Insert, Update, and Delete messages.
 * 'N' - New tuple (for INSERT and UPDATE)
 * 'O' - Old tuple (for UPDATE if REPLICA IDENTITY is not 'nothing')
 * 'K' - Key (for UPDATE if REPLICA IDENTITY is 'nothing')
 */
export const TUPLE_KIND = Object.freeze({
  NEW: 'N',
  OLD: 'O',
  KEY: 'K',
});