/**
 * @file src/utils/db-client.js
 * @description Manages a singleton PostgreSQL client instance.
 *
 * This module provides a centralized way to connect to a PostgreSQL database.
 * It uses a singleton pattern to ensure that only one connection is established
 * per process, which is then shared across different parts of the application.
 * The connection details are automatically sourced from standard PostgreSQL
 * environment variables (e.g., PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
 * or a connection string (DATABASE_URL).
 */

import pg from 'pg';

const { Client } = pg;

/**
 * A singleton instance of the PostgreSQL client.
 * This is initialized to null and created on the first call to `getClient`.
 * @type {pg.Client | null}
 */
let clientInstance = null;

/**
 * Creates and connects a new PostgreSQL client instance.
 * The client configuration is automatically read from environment variables
 * by the `pg` library.
 *
 * @returns {Promise<pg.Client>} A promise that resolves with the connected client instance.
 * @throws {Error} If the connection to the database fails.
 */
const createAndConnectClient = async () => {
  const client = new Client(); // `pg` automatically uses env vars
  try {
    await client.connect();
    console.error('Successfully connected to PostgreSQL.'); // Log to stderr for info
    return client;
  } catch (error) {
    console.error('Error: Failed to connect to the PostgreSQL database.');
    console.error(
      'Please ensure your connection details (PGHOST, PGUSER, PGDATABASE, etc.) are correctly configured.',
    );
    // Re-throw the original error for the caller to handle, preserving the stack trace.
    throw error;
  }
};

/**
 * Returns a singleton instance of the connected PostgreSQL client.
 * If a client instance does not exist, it creates one, connects it, and stores it for future use.
 *
 * This function is the primary export and should be used by all other modules
 * that need to interact with the database.
 *
 * @returns {Promise<pg.Client>} A promise that resolves with the singleton client instance.
 */
export const getClient = async () => {
  if (!clientInstance) {
    clientInstance = await createAndConnectClient();
  }
  return clientInstance;
};

/**
 * Gracefully disconnects the singleton PostgreSQL client if it's connected.
 * This should be called before the application exits to ensure a clean shutdown.
 *
 * @returns {Promise<void>} A promise that resolves when the client is disconnected.
 */
export const disconnectClient = async () => {
  if (clientInstance) {
    try {
      await clientInstance.end();
      console.error('PostgreSQL client disconnected.'); // Log to stderr for info
      clientInstance = null;
    } catch (error) {
      // Log the error but don't re-throw, as this is part of a shutdown sequence.
      // The application is likely terminating anyway.
      console.error('Error during PostgreSQL client disconnection:', error);
    }
  }
};