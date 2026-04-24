/**
 * examples/simple-logger.js
 *
 * This example demonstrates the basic usage of the `PgLogicalStream` client.
 * It connects to a PostgreSQL logical replication stream and logs every
 * change (insert, update, delete, truncate) to the console.
 *
 * This script is a great starting point for understanding the event-driven
 * nature of the library and for verifying that your PostgreSQL setup
 * (publication, slot, user permissions) is correct.
 *
 * To run this example:
 * 1. Ensure you have a PostgreSQL server with a publication and a logical
 *    replication slot configured. See the project's README.md for setup instructions.
 * 2. Set the required environment variables (PGHOST, PGUSER, PGPASSWORD, etc.).
 * 3. Run the script from your terminal: `node examples/simple-logger.js`
 * 4. Make changes to the tables included in your publication, and you will see
 *    the corresponding log messages appear in the console.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { PgLogicalStream } from '../src/client.js';
import { DEFAULTS } from '../src/constants.js';

/**
 * Main function to set up and run the logical replication stream logger.
 */
async function main() {
  console.log('Initializing PostgreSQL Logical Stream Logger...');

  // Configuration is pulled from environment variables for security and flexibility.
  // The library's defaults are used for the slot and publication names if not specified.
  const connectionConfig = {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || DEFAULTS.PG_PORT,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD, // Should be set in the environment
  };

  const slotName = process.env.PG_SLOT_NAME || DEFAULTS.SLOT_NAME;
  const publicationName = process.env.PG_PUBLICATION_NAME || DEFAULTS.PUBLICATION_NAME;

  if (!connectionConfig.password) {
    console.warn('Warning: PGPASSWORD environment variable is not set. Connection may fail.');
  }

  // Instantiate the client with the connection and stream options.
  const stream = new PgLogicalStream({
    connection: connectionConfig,
    slotName: slotName,
    publicationName: publicationName,
  });

  // --- Attach Event Listeners ---

  // Fired once the connection is established and the stream is active.
  stream.on('connect', () => {
    console.log(`✅ Stream connected to slot "${slotName}" and publication "${publicationName}".`);
    console.log('Listening for database changes... (Press Ctrl+C to stop)');
  });

  // Fired on any non-recoverable error. The stream will attempt to shut down.
  stream.on('error', (error) => {
    console.error('❌ An error occurred:', error.message);
    // In a real application, you might implement a reconnection strategy here.
  });

  // Fired when the connection is cleanly closed.
  stream.on('close', () => {
    console.log('🔌 Stream connection closed.');
  });

  // Fired for every parsed logical replication message.
  // This is a good place for generic, low-level logging.
  stream.on('data', (message) => {
    // For this example, we'll use the more specific event listeners below,
    // but this 'data' event is useful for seeing the raw message flow.
    // console.log('Raw message received:', message.tag);
  });

  // --- DML Event Listeners ---

  stream.on('insert', (message) => {
    console.log(
      `[INSERT] Table: ${message.schema}.${message.table} | New data:`,
      message.new
    );
  });

  stream.on('update', (message) => {
    console.log(
      `[UPDATE] Table: ${message.schema}.${message.table} | Old:`,
      message.old ?? '(not available)', // `old` is null if replica identity is not FULL
      '| New:',
      message.new
    );
  });

  stream.on('delete', (message) => {
    console.log(
      `[DELETE] Table: ${message.schema}.${message.table} | Deleted data:`,
      message.old
    );
  });

  stream.on('truncate', (message) => {
    console.log(
      `[TRUNCATE] Relation IDs: ${message.relationIds.join(', ')}`
    );
  });

  // --- Graceful Shutdown Handling ---

  const shutdown = async () => {
    console.log('\nReceived shutdown signal. Gracefully closing stream...');
    try {
      await stream.stop();
      console.log('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  // Listen for termination signals to ensure a clean exit.
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // --- Start the Stream ---

  try {
    console.log(`Attempting to start stream...`);
    await stream.start();
  } catch (error) {
    console.error('🚨 Failed to start the logical replication stream.');
    console.error('   Please check the following:');
    console.error('   - PostgreSQL server is running and accessible.');
    console.error('   - Connection details (host, user, password, etc.) are correct.');
    console.error(`   - The replication slot "${slotName}" exists and is a logical slot.`);
    console.error(`   - The publication "${publicationName}" exists.`);
    console.error('   - The user has the REPLICATION attribute and SELECT permissions on published tables.');
    // The specific error from the client will have been emitted on the 'error' event.
    process.exit(1);
  }
}

// Execute the main function.
main().catch((err) => {
  // This catch block handles any unexpected errors during initial setup.
  console.error('An unexpected error occurred during initialization:', err);
  process.exit(1);
});