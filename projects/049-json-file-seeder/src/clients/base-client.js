/**
 * @file src/clients/base-client.js
 * @description A base class defining the interface that all database clients must implement.
 * This class is not intended to be instantiated directly. Instead, other clients
 * (e.g., MongoClient, PostgresClient) should extend it and provide concrete
 * implementations for its methods.
 */

/**
 * Represents a generic error for methods that are not implemented in a subclass.
 * This ensures that any client extending BaseClient provides the required functionality.
 */
class NotImplementedError extends Error {
  /**
   * @param {string} methodName - The name of the method that was not implemented.
   */
  constructor(methodName) {
    super(`Method '${methodName}' must be implemented by the subclass.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * BaseClient serves as an abstract base class for database clients.
 * It defines a common interface for connecting, disconnecting, and inserting data,
 * ensuring that all supported database clients behave consistently within the seeder.
 */
class BaseClient {
  /**
   * @param {string} connectionString - The connection string for the database.
   * @param {object} options - Client-specific options.
   */
  constructor(connectionString, options = {}) {
    if (this.constructor === BaseClient) {
      throw new TypeError('Abstract class "BaseClient" cannot be instantiated directly.');
    }
    this.connectionString = connectionString;
    this.options = options;
  }

  /**
   * Establishes a connection to the database.
   * Subclasses must implement this method to handle the specifics of their
   * database connection logic.
   * @abstract
   * @returns {Promise<void>} A promise that resolves when the connection is successful.
   */
  async connect() {
    throw new NotImplementedError('connect');
  }

  /**
   * Closes the connection to the database.
   * Subclasses must implement this method to handle the graceful disconnection
   * from their database.
   * @abstract
   * @returns {Promise<void>} A promise that resolves when the disconnection is complete.
   */
  async disconnect() {
    throw new NotImplementedError('disconnect');
  }

  /**
   * Inserts data into a specified collection or table.
   * Subclasses must implement this method to handle the data insertion logic
   * specific to their database.
   * @abstract
   * @param {string} target - The name of the collection or table to insert data into.
   * @param {object | object[]} data - The data to insert, either a single object or an array of objects.
   * @returns {Promise<number>} A promise that resolves with the number of records inserted.
   */
  async insert(target, data) {
    // The unused `target` and `data` parameters are kept for interface consistency.
    // eslint-disable-next-line no-unused-vars
    throw new NotImplementedError('insert');
  }
}

export default BaseClient;