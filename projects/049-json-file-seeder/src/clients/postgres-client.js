/**
 * @file src/clients/postgres-client.js
 * @description PostgreSQL client implementation that extends BaseClient and uses the `pg` package to insert data.
 */

import { Client } from 'pg';
import BaseClient from './base-client.js';
import logger from '../utils/logger.js';

/**
 * A PostgreSQL client for the JSON File Seeder.
 *
 * This class manages the connection to a PostgreSQL database and provides
 * a method for inserting data into a specified table. It extends the
 * `BaseClient` to ensure a consistent interface across different database clients.
 * It uses a single client connection for the duration of the seeding process.
 */
class PostgresClient extends BaseClient {
  /**
   * The native `pg` client instance.
   * @private
   * @type {Client | null}
   */
  #client = null;

  /**
   * Initializes a new instance of the PostgresClient.
   *
   * @param {string} connectionString - The PostgreSQL connection string (e.g., "postgresql://user:password@host:port/database").
   * @param {object} [options={}] - Additional options for the `pg` client.
   */
  constructor(connectionString, options = {}) {
    super(connectionString, options);
    // The `pg` Client constructor accepts the connection string directly.
    // Additional options can be passed as a configuration object, but the
    // connection string takes precedence for connection parameters.
    // We merge them here for clarity, though `pg` handles this internally.
    const config = {
      connectionString: this.connectionString,
      ...this.options,
    };
    this.#client = new Client(config);
  }

  /**
   * Establishes a connection to the PostgreSQL database.
   *
   * @throws {Error} If the connection fails.
   * @returns {Promise<void>} A promise that resolves when the connection is successful.
   */
  async connect() {
    if (!this.#client) {
      throw new Error('Postgres client has not been initialized.');
    }

    try {
      await this.#client.connect();
      const { database, host, port } = this.#client;
      logger.info(`Successfully connected to PostgreSQL database "${database}" on ${host}:${port}`);
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL.');
      // Re-throw to allow the caller to handle the connection failure.
      throw error;
    }
  }

  /**
   * Closes the connection to the PostgreSQL database.
   *
   * @returns {Promise<void>} A promise that resolves when the disconnection is complete.
   */
  async disconnect() {
    if (this.#client) {
      try {
        await this.#client.end();
        logger.info('PostgreSQL connection closed.');
        this.#client = null;
      } catch (error) {
        logger.error('Error while disconnecting from PostgreSQL.');
        // Re-throw to inform the caller of the issue.
        throw error;
      }
    }
  }

  /**
   * Inserts data into a specified PostgreSQL table.
   * This method constructs a single `INSERT` statement with multiple `VALUES` clauses
   * for efficient bulk insertion.
   *
   * @param {string} tableName - The name of the table to insert data into.
   * @param {object | object[]} data - The data to insert. Can be a single object or an array of objects.
   * @throws {Error} If the client is not connected, if the table name is missing,
   *                 if the data is invalid, or if the insertion query fails.
   * @returns {Promise<number>} A promise that resolves with the number of rows inserted.
   */
  async insert(tableName, data) {
    if (!this.#client || this.#client._ending) {
      throw new Error('Cannot insert data: PostgreSQL client is not connected.');
    }

    if (!tableName) {
      throw new Error('Table name must be provided for insertion.');
    }

    const records = Array.isArray(data) ? data : [data];
    if (records.length === 0) {
      logger.warn(`Skipping insertion into '${tableName}' as the data array is empty.`);
      return 0;
    }

    // Use the keys from the first record to determine the columns.
    // This assumes all records in the array have the same structure.
    const columns = Object.keys(records[0]);
    if (columns.length === 0) {
      throw new Error('Cannot insert empty objects.');
    }

    // Flatten all values from all records into a single array for parameterization.
    const allValues = records.flatMap(record => columns.map(col => record[col]));

    // Generate the value placeholders, e.g., ($1, $2, $3), ($4, $5, $6)
    const valuePlaceholders = records.map((_, rowIndex) => {
      const startIndex = rowIndex * columns.length + 1;
      const placeholders = columns.map((__, colIndex) => `$${startIndex + colIndex}`).join(', ');
      return `(${placeholders})`;
    }).join(', ');

    // Escape column names to handle reserved keywords and special characters.
    const columnNames = columns.map(col => `"${col}"`).join(', ');

    // Construct the final SQL query.
    // Example: INSERT INTO "users" ("id", "name") VALUES ($1, $2), ($3, $4)
    const query = `INSERT INTO "${tableName}" (${columnNames}) VALUES ${valuePlaceholders}`;

    try {
      const result = await this.#client.query(query, allValues);
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error(`Failed to insert data into table '${tableName}'.`);
      // Add context to the error message for better debugging.
      error.message = `PostgreSQL insert failed: ${error.message}\nTable: ${tableName}\nHint: Ensure the table and columns exist and data types match.`;
      throw error;
    }
  }
}

export default PostgresClient;