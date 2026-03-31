/**
 * @file src/clients/mongo-client.js
 * @description MongoDB client implementation that extends BaseClient and uses the `mongodb` package to insert data.
 */

import { MongoClient as Mongo } from 'mongodb';
import BaseClient from './base-client.js';
import logger from '../utils/logger.js';

/**
 * A MongoDB client for the JSON File Seeder.
 *
 * This class handles the connection to a MongoDB database and provides
 * a method for inserting data into a specified collection. It extends
 * the `BaseClient` to ensure a consistent interface across different
 * database clients.
 */
class MongoClient extends BaseClient {
  /**
   * The native MongoDB client instance.
   * @private
   * @type {Mongo | null}
   */
  #client = null;

  /**
   * The connected MongoDB database instance.
   * @private
   * @type {import('mongodb').Db | null}
   */
  #db = null;

  /**
   * Initializes a new instance of the MongoClient.
   *
   * @param {string} connectionString - The MongoDB connection string (e.g., "mongodb://localhost:27017/mydatabase").
   * @param {object} [options={}] - Additional options.
   * @param {string} [options.dbName] - The name of the database to connect to. If not provided, it will be parsed from the connection string.
   */
  constructor(connectionString, options = {}) {
    super(connectionString, options);
    this.dbName = options.dbName;
  }

  /**
   * Establishes a connection to the MongoDB server and selects the database.
   *
   * @throws {Error} If the connection fails or the database name is not specified.
   * @returns {Promise<void>} A promise that resolves when the connection is successful.
   */
  async connect() {
    try {
      // The `useUnifiedTopology` option is deprecated and no longer needed in v4+ of the driver.
      // The driver now defaults to the unified topology.
      this.#client = new Mongo(this.connectionString);
      await this.#client.connect();

      // Determine the database to use.
      // The dbName can be specified in the connection string or via the options.
      const dbName = this.dbName || this.#client.options.dbName;
      if (!dbName) {
        throw new Error(
          'MongoDB database name not specified. Include it in the connection string (e.g., "mongodb://.../dbname") or provide it as a client option.'
        );
      }

      this.#db = this.#client.db(dbName);
      logger.info(`Successfully connected to MongoDB database: ${dbName}`);
    } catch (error) {
      logger.error('Failed to connect to MongoDB.');
      // Re-throw to allow the caller to handle the connection failure.
      throw error;
    }
  }

  /**
   * Closes the connection to the MongoDB server.
   *
   * @returns {Promise<void>} A promise that resolves when the disconnection is complete.
   */
  async disconnect() {
    if (this.#client) {
      try {
        await this.#client.close();
        logger.info('MongoDB connection closed.');
        this.#client = null;
        this.#db = null;
      } catch (error) {
        logger.error('Error while disconnecting from MongoDB.');
        // Re-throw to inform the caller of the issue.
        throw error;
      }
    }
  }

  /**
   * Inserts data into a specified MongoDB collection.
   *
   * @param {string} collectionName - The name of the collection to insert data into.
   * @param {object | object[]} data - The data to insert. Can be a single document or an array of documents.
   * @throws {Error} If the client is not connected or if the insertion fails.
   * @returns {Promise<number>} A promise that resolves with the number of documents inserted.
   */
  async insert(collectionName, data) {
    if (!this.#db) {
      throw new Error('Cannot insert data: MongoDB client is not connected to a database.');
    }

    if (!collectionName) {
      throw new Error('Collection name must be provided for insertion.');
    }

    const collection = this.#db.collection(collectionName);
    let result;

    try {
      if (Array.isArray(data)) {
        if (data.length === 0) {
          logger.warn(`Skipping insertion into '${collectionName}' as the data array is empty.`);
          return 0;
        }
        result = await collection.insertMany(data);
      } else {
        result = await collection.insertOne(data);
      }
    } catch (error) {
      logger.error(`Failed to insert data into collection '${collectionName}'.`);
      throw error;
    }

    // `insertedCount` is available on both `insertMany` and `insertOne` results.
    return result.insertedCount;
  }
}

export default MongoClient;