/**
 * src/type-deserializer.js
 *
 * This module handles the deserialization of PostgreSQL data types from their
 * text representation in replication tuples into appropriate JavaScript types.
 *
 * When `pgoutput` sends row data, all values are encoded as text. This module
 * provides a flexible way to parse these text values based on their PostgreSQL
 * type OID, ensuring that numbers are numbers, booleans are booleans, and so on.
 *
 * It maintains a map of known type OIDs to their parsing functions. Users can
 * also register custom parsers for user-defined types or to override default
 * behavior.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 * @see https://www.postgresql.org/docs/current/catalog-pg-type.html
 */

// PostgreSQL epoch is 2000-01-01 00:00:00 UTC
const POSTGRES_EPOCH_MS = 946684800000;

/**
 * A registry and handler for deserializing PostgreSQL data types from their
 * text representation into JavaScript types.
 */
export class TypeDeserializer {
  /**
   * @private
   * @type {Map<number, (value: string) => any>}
   * A map where keys are PostgreSQL type OIDs and values are functions that
   * parse the text representation of that type into a JavaScript value.
   */
  #parsers = new Map();

  constructor() {
    this.#registerDefaultParsers();
  }

  /**
   * Registers a custom parser for a specific PostgreSQL type OID.
   * This can be used to add support for custom types or override default parsing behavior.
   *
   * @param {number} typeId The PostgreSQL type OID.
   * @param {(value: string) => any} parser The function to parse the text value.
   */
  register(typeId, parser) {
    if (typeof typeId !== 'number' || !Number.isInteger(typeId)) {
      throw new Error('typeId must be an integer.');
    }
    if (typeof parser !== 'function') {
      throw new Error('parser must be a function.');
    }
    this.#parsers.set(typeId, parser);
  }

  /**
   * Deserializes a text value into a JavaScript type based on the provided
   * PostgreSQL type OID.
   *
   * If a value is `null` or `undefined`, it is returned as is.
   * If no parser is found for the given type OID, the original text value is returned.
   *
   * @param {string | null | undefined} value The text value from the replication stream.
   * @param {number} typeId The PostgreSQL type OID for the value.
   * @returns {any} The parsed JavaScript value, or the original string if no parser is found.
   */
  deserialize(value, typeId) {
    if (value === null || value === undefined) {
      return null;
    }

    const parser = this.#parsers.get(typeId);
    if (parser) {
      try {
        return parser(value);
      } catch (error) {
        console.warn(`Error parsing value "${value}" with typeId ${typeId}: ${error.message}`);
        // Fallback to returning the raw string on parsing error
        return value;
      }
    }

    // If no parser is registered, return the raw string value.
    return value;
  }

  /**
   * @private
   * Registers the default set of parsers for common PostgreSQL built-in types.
   * Type OIDs are based on a standard PostgreSQL 12+ installation.
   * @see `SELECT oid, typname FROM pg_type ORDER BY oid;`
   */
  #registerDefaultParsers() {
    // boolean
    this.#parsers.set(16, (v) => v === 't');

    // bytea
    this.#parsers.set(17, (v) => Buffer.from(v.substring(2), 'hex')); // '\\xDEADBEEF' -> <Buffer DE AD BE EF>

    // int8 / bigint
    this.#parsers.set(20, BigInt);
    // int2 / smallint
    this.#parsers.set(21, parseInt);
    // int4 / integer
    this.#parsers.set(23, parseInt);

    // text
    this.#parsers.set(25, String);

    // json
    this.#parsers.set(114, JSON.parse);

    // float4 / real
    this.#parsers.set(700, parseFloat);
    // float8 / double precision
    this.#parsers.set(701, parseFloat);

    // varchar
    this.#parsers.set(1043, String);

    // date
    this.#parsers.set(1082, String); // Keep as ISO 8601 string 'YYYY-MM-DD'

    // timestamp without time zone
    this.#parsers.set(1114, (v) => new Date(v.replace(' ', 'T') + 'Z'));

    // timestamp with time zone
    this.#parsers.set(1184, (v) => new Date(v.replace(' ', 'T')));

    // jsonb
    this.#parsers.set(3802, JSON.parse);

    // numeric / decimal
    // Note: This can lose precision for very large numbers. For full precision,
    // consider using a library like 'decimal.js' and a custom parser.
    this.#parsers.set(1700, parseFloat);

    // uuid
    this.#parsers.set(2950, String);
  }
}