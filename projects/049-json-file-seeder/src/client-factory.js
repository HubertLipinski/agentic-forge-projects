/**
 * @file src/client-factory.js
 * @description A factory function that returns an appropriate database client instance based on a provided type string.
 * This module centralizes the creation of database clients, making it easy to extend the seeder
 * with new database types in the future.
 */

import MongoClient from './clients/mongo-client.js';
import PostgresClient from './clients/postgres-client.js';

/**
 * A map of supported client types to their corresponding client classes.
 * To add support for a new database, import its client class and add it to this map.
 * The key should be a lowercase string identifier for the CLI.
 *
 * @type {Object.<string, import('./clients/base-client.js').default>}
 */
const clientMap = {
  mongodb: MongoClient,
  postgres: PostgresClient,
  // Add new client classes here, e.g., 'mysql': MySqlClient
};

/**
 * Creates and returns a database client instance based on the specified type.
 *
 * This factory function abstracts the instantiation of different database clients,
 * allowing the seeder to work with any supported database through a common interface.
 *
 * @param {string} type - The type of database client to create (e.g., 'mongodb', 'postgres').
 * @param {string} connectionString - The connection string for the database.
 * @param {object} [options={}] - Client-specific options to pass to the constructor.
 * @returns {import('./clients/base-client.js').default} An instance of the requested database client.
 * @throws {Error} If the client type is unsupported.
 */
function createClient(type, connectionString, options = {}) {
  const clientType = type?.toLowerCase();
  const ClientClass = clientMap[clientType];

  if (!ClientClass) {
    const supportedTypes = Object.keys(clientMap).join(', ');
    throw new Error(
      `Unsupported client type: '${type}'. Supported types are: ${supportedTypes}.`
    );
  }

  return new ClientClass(connectionString, options);
}

export { createClient };