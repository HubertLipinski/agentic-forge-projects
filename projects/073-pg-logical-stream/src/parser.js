/**
 * src/parser.js
 *
 * This module is responsible for parsing the binary `pgoutput` logical replication
 * protocol messages sent by PostgreSQL. It decodes the raw Buffer data from
 * `CopyData` messages into structured JavaScript objects representing database
 * changes (Begin, Commit, Relation, Insert, Update, Delete, Truncate).
 *
 * The parser maintains a `relations` map to cache table schema information, which
 * is crucial for correctly interpreting subsequent DML messages.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 * @see https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html
 */

import { PG_OUTPUT_MESSAGE_CODES, TUPLE_KIND } from './constants.js';

/**
 * A stateful parser for PostgreSQL's `pgoutput` logical replication messages.
 * It maintains a map of relation schemas to correctly parse DML operations.
 */
export class PgOutputParser {
  /**
   * @private
   * @type {Map<number, object>}
   * A map where keys are relation OIDs and values are objects describing
   * the relation's schema (name, namespace, columns).
   */
  #relations = new Map();

  /**
   * Parses a raw buffer from a PostgreSQL `CopyData` message containing a
   * `pgoutput` message.
   *
   * @param {Buffer} buffer The raw message buffer.
   * @returns {object | null} A structured object representing the logical
   * replication message, or null if the message type is unknown or unhandled.
   */
  parse(buffer) {
    const messageType = String.fromCharCode(buffer.readUInt8(0));
    const payload = buffer.subarray(1);

    switch (messageType) {
      case PG_OUTPUT_MESSAGE_CODES.Begin:
        return this.#parseBegin(payload);
      case PG_OUTPUT_MESSAGE_CODES.Commit:
        return this.#parseCommit(payload);
      case PG_OUTPUT_MESSAGE_CODES.Relation:
        return this.#parseRelation(payload);
      case PG_OUTPUT_MESSAGE_CODES.Insert:
        return this.#parseInsert(payload);
      case PG_OUTPUT_MESSAGE_CODES.Update:
        return this.#parseUpdate(payload);
      case PG_OUTPUT_MESSAGE_CODES.Delete:
        return this.#parseDelete(payload);
      case PG_OUTPUT_MESSAGE_CODES.Truncate:
        return this.#parseTruncate(payload);
      // 'Type', 'Origin', and 'LogicalDecodingMessage' are valid but not
      // handled by this client, as they are less common for typical CDC.
      case PG_OUTPUT_MESSAGE_CODES.Type:
      case PG_OUTPUT_MESSAGE_CODES.Origin:
      case PG_OUTPUT_MESSAGE_CODES.LogicalDecodingMessage:
        return { tag: 'unhandled', type: messageType };
      default:
        // This case should ideally not be reached if the stream is valid.
        console.warn(`Unknown pgoutput message type: "${messageType}"`);
        return null;
    }
  }

  /**
   * Clears the internal cache of relation schemas.
   * This is useful when reconnecting or resetting the stream state.
   */
  reset() {
    this.#relations.clear();
  }

  /**
   * @private
   * Parses a Begin message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Begin message.
   */
  #parseBegin(buffer) {
    let offset = 0;
    // Final LSN of the transaction.
    const finalLsn = buffer.readBigUInt64BE(offset);
    offset += 8;
    // Commit timestamp of the transaction.
    const commitTimestamp = buffer.readBigUInt64BE(offset);
    offset += 8;
    // Transaction ID (XID).
    const xid = buffer.readUInt32BE(offset);

    return {
      tag: 'begin',
      finalLsn: finalLsn.toString(),
      commitTimestamp: this.#convertPostgresTimestamp(commitTimestamp),
      xid,
    };
  }

  /**
   * @private
   * Parses a Commit message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Commit message.
   */
  #parseCommit(buffer) {
    let offset = 0;
    // Flags; currently unused, always 0.
    offset += 1;
    // LSN of the commit.
    const commitLsn = buffer.readBigUInt64BE(offset);
    offset += 8;
    // The LSN of the end of the transaction.
    const transactionEndLsn = buffer.readBigUInt64BE(offset);
    offset += 8;
    // Commit timestamp of the transaction.
    const commitTimestamp = buffer.readBigUInt64BE(offset);

    return {
      tag: 'commit',
      commitLsn: commitLsn.toString(),
      transactionEndLsn: transactionEndLsn.toString(),
      commitTimestamp: this.#convertPostgresTimestamp(commitTimestamp),
    };
  }

  /**
   * @private
   * Parses a Relation message and caches its schema.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Relation message.
   */
  #parseRelation(buffer) {
    let offset = 0;
    const relationId = buffer.readUInt32BE(offset);
    offset += 4;

    const [namespace, namespaceEnd] = this.#readCString(buffer, offset);
    offset = namespaceEnd;

    const [relationName, relationNameEnd] = this.#readCString(buffer, offset);
    offset = relationNameEnd;

    const replicaIdentity = String.fromCharCode(buffer.readUInt8(offset));
    offset += 1;

    const columnCount = buffer.readUInt16BE(offset);
    offset += 2;

    const columns = [];
    for (let i = 0; i < columnCount; i++) {
      const isKey = buffer.readUInt8(offset) !== 0;
      offset += 1;

      const [columnName, columnNameEnd] = this.#readCString(buffer, offset);
      offset = columnNameEnd;

      const columnTypeId = buffer.readUInt32BE(offset);
      offset += 4;

      const columnTypeMod = buffer.readInt32BE(offset);
      offset += 4;

      columns.push({
        name: columnName,
        isKey,
        typeId: columnTypeId,
        typeMod: columnTypeMod,
      });
    }

    const relation = {
      relationId,
      namespace,
      name: relationName,
      replicaIdentity,
      columns,
    };

    this.#relations.set(relationId, relation);

    return { tag: 'relation', ...relation };
  }

  /**
   * @private
   * Parses an Insert message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Insert message.
   */
  #parseInsert(buffer) {
    let offset = 0;
    const relationId = buffer.readUInt32BE(offset);
    offset += 4;

    const tupleType = String.fromCharCode(buffer.readUInt8(offset)); // Should be 'N' for New
    offset += 1;

    if (tupleType !== TUPLE_KIND.NEW) {
      throw new Error(`Invalid tuple type for INSERT: expected 'N', got '${tupleType}'`);
    }

    const relation = this.#relations.get(relationId);
    if (!relation) {
      throw new Error(`Received INSERT for unknown relationId: ${relationId}. A Relation message must precede DML messages.`);
    }

    const [newTuple] = this.#parseTupleData(buffer, offset);

    return {
      tag: 'insert',
      relationId,
      schema: relation.namespace,
      table: relation.name,
      columns: relation.columns,
      new: newTuple,
    };
  }

  /**
   * @private
   * Parses an Update message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Update message.
   */
  #parseUpdate(buffer) {
    let offset = 0;
    const relationId = buffer.readUInt32BE(offset);
    offset += 4;

    const relation = this.#relations.get(relationId);
    if (!relation) {
      throw new Error(`Received UPDATE for unknown relationId: ${relationId}. A Relation message must precede DML messages.`);
    }

    let oldTuple = null;
    let keyTuple = null;

    const tupleType = String.fromCharCode(buffer.readUInt8(offset));
    offset += 1;

    // 'O' (old) or 'K' (key) tuple may be present depending on REPLICA IDENTITY
    if (tupleType === TUPLE_KIND.OLD || tupleType === TUPLE_KIND.KEY) {
      const [tuple, nextOffset] = this.#parseTupleData(buffer, offset);
      offset = nextOffset;
      if (tupleType === TUPLE_KIND.OLD) {
        oldTuple = tuple;
      } else {
        keyTuple = tuple;
      }
    }

    // The new tuple must be present
    const newTupleType = String.fromCharCode(buffer.readUInt8(offset));
    offset += 1;

    if (newTupleType !== TUPLE_KIND.NEW) {
      throw new Error(`Invalid new tuple type for UPDATE: expected 'N', got '${newTupleType}'`);
    }

    const [newTuple] = this.#parseTupleData(buffer, offset);

    return {
      tag: 'update',
      relationId,
      schema: relation.namespace,
      table: relation.name,
      columns: relation.columns,
      key: keyTuple,
      old: oldTuple,
      new: newTuple,
    };
  }

  /**
   * @private
   * Parses a Delete message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Delete message.
   */
  #parseDelete(buffer) {
    let offset = 0;
    const relationId = buffer.readUInt32BE(offset);
    offset += 4;

    const relation = this.#relations.get(relationId);
    if (!relation) {
      throw new Error(`Received DELETE for unknown relationId: ${relationId}. A Relation message must precede DML messages.`);
    }

    const tupleType = String.fromCharCode(buffer.readUInt8(offset));
    offset += 1;

    if (tupleType !== TUPLE_KIND.OLD && tupleType !== TUPLE_KIND.KEY) {
      throw new Error(`Invalid tuple type for DELETE: expected 'O' or 'K', got '${tupleType}'`);
    }

    const [oldTuple] = this.#parseTupleData(buffer, offset);

    return {
      tag: 'delete',
      relationId,
      schema: relation.namespace,
      table: relation.name,
      columns: relation.columns,
      old: oldTuple,
    };
  }

  /**
   * @private
   * Parses a Truncate message.
   * @param {Buffer} buffer The message payload.
   * @returns {object} The parsed Truncate message.
   */
  #parseTruncate(buffer) {
    let offset = 0;
    const numRelations = buffer.readUInt32BE(offset);
    offset += 4;

    const options = buffer.readUInt8(offset);
    offset += 1;

    const relationIds = [];
    for (let i = 0; i < numRelations; i++) {
      relationIds.push(buffer.readUInt32BE(offset));
      offset += 4;
    }

    return {
      tag: 'truncate',
      relationIds,
      // TRUNCATE_OPTION_CASCADE = 1, TRUNCATE_OPTION_RESTART_IDENTITY = 2
      isCascade: (options & 1) !== 0,
      isRestartIdentity: (options & 2) !== 0,
    };
  }

  /**
   * @private
   * Parses a TupleData sub-message.
   * @param {Buffer} buffer The buffer containing the tuple data.
   * @param {number} offset The starting offset within the buffer.
   * @returns {[object, number]} A tuple containing the parsed data object and the new offset.
   */
  #parseTupleData(buffer, offset) {
    const columnCount = buffer.readUInt16BE(offset);
    offset += 2;

    const tuple = {};
    for (let i = 0; i < columnCount; i++) {
      const columnType = String.fromCharCode(buffer.readUInt8(offset));
      offset += 1;

      switch (columnType) {
        case 'n': // NULL value
          tuple[i] = null;
          break;
        case 'u': // Unchanged TOASTed value (not sent)
          tuple[i] = undefined; // Or a specific symbol/sentinel value
          break;
        case 't': { // Text formatted value
          const len = buffer.readUInt32BE(offset);
          offset += 4;
          tuple[i] = buffer.toString('utf8', offset, offset + len);
          offset += len;
          break;
        }
        default:
          throw new Error(`Unknown tuple data column type: ${columnType}`);
      }
    }
    return [tuple, offset];
  }

  /**
   * @private
   * Reads a null-terminated C-style string from a buffer.
   * @param {Buffer} buffer The buffer to read from.
   * @param {number} offset The starting offset.
   * @returns {[string, number]} A tuple containing the read string and the new offset after the null terminator.
   */
  #readCString(buffer, offset) {
    const nullTerminatorIndex = buffer.indexOf(0, offset);
    if (nullTerminatorIndex === -1) {
      throw new Error('Invalid C-style string: no null terminator found.');
    }
    const str = buffer.toString('utf8', offset, nullTerminatorIndex);
    return [str, nullTerminatorIndex + 1];
  }

  /**
   * @private
   * Converts a PostgreSQL timestamp (microseconds since 2000-01-01) to a JS Date.
   * @param {bigint} pgTimestamp The PostgreSQL timestamp.
   * @returns {Date} The corresponding JavaScript Date object.
   */
  #convertPostgresTimestamp(pgTimestamp) {
    // PostgreSQL epoch is 2000-01-01 00:00:00 UTC
    // JavaScript epoch is 1970-01-01 00:00:00 UTC
    // The difference is 946684800000 milliseconds.
    const POSTGRES_EPOCH_MS = 946684800000n;
    const us = pgTimestamp;
    const ms = us / 1000n;
    return new Date(Number(ms + POSTGRES_EPOCH_MS));
  }
}