/**
 * @file src/db/client-factory.js
 * @description Factory function for creating database-specific client instances.
 *
 * This module provides a single point of entry for instantiating database clients.
 * Based on the 'type' specified in the database configuration, it returns the
 * appropriate client instance (e.g., `PostgresClient` or `MysqlClient`). This
 * decouples the main application logic from the concrete client implementations,
 * adhering to the factory design pattern.
 */

import { PostgresClient } from './clients/postgres-client.js';
import { MysqlClient } from './clients/mysql-client.js';

/**
 * Custom error class for factory-related issues.
 */
class ClientFactoryError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'ClientFactoryError';
  }
}

/**
 * A map of supported database types to their corresponding client classes.
 * This allows for easy extension with new database clients in the future.
 *
 * @private
 * @type {Object<string, import('./clients/base-client.js').BaseClient>}
 */
const clientMap = {
  postgres: PostgresClient,
  mysql: MysqlClient,
};

/**
 * Creates and returns a database client instance based on the provided configuration.
 *
 * The factory function looks at the `type` property of the `dbConfig` object
 * to determine which client to instantiate. It then passes the rest of the
 * configuration object to the client's constructor.
 *
 * @param {object} dbConfig - The database configuration object.
 * @param {string} dbConfig.type - The type of database (e.g., 'postgres', 'mysql').
 * @param {object} dbConfig.connection - The connection details for the database driver.
 * @returns {import('./clients/base-client.js').BaseClient} An instance of a class that extends `BaseClient`.
 * @throws {ClientFactoryError} If the database type is missing, unsupported, or if the configuration is invalid.
 */
export function createDbClient(dbConfig) {
  if (!dbConfig || typeof dbConfig !== 'object') {
    throw new ClientFactoryError('Database configuration object is required.');
  }

  const { type, ...connectionDetails } = dbConfig;

  if (!type || typeof type !== 'string') {
    throw new ClientFactoryError("Database configuration must include a 'type' property (e.g., 'postgres', 'mysql').");
  }

  const clientType = type.toLowerCase();
  const ClientClass = clientMap[clientType];

  if (!ClientClass) {
    const supportedTypes = Object.keys(clientMap).join(', ');
    throw new ClientFactoryError(`Unsupported database type '${type}'. Supported types are: ${supportedTypes}.`);
  }

  try {
    // The connectionDetails object (e.g., { host, user, password, ... }) is passed
    // to the constructor of the specific client (PostgresClient or MysqlClient).
    return new ClientClass(connectionDetails);
  } catch (error) {
    // Catch potential errors from the client constructor itself.
    throw new ClientFactoryError(`Failed to instantiate client for type '${type}': ${error.message}`);
  }
}