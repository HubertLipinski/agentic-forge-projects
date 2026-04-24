#!/usr/bin/env node

/**
 * examples/audit-trail-builder.js
 *
 * This advanced example demonstrates how to use the `pg-logical-streamer`
 * library to build a detailed audit trail for specific database tables.
 *
 * It connects to a PostgreSQL logical replication stream, filters for changes
 * to a predefined set of tables (`users` and `products`), and writes a
 * structured log of these changes to a file (`audit.log`).
 *
 * This script showcases:
 * - Connecting to a replication stream with custom options.
 * - Listening for specific DML events (`insert`, `update`, `delete`).
 * - Filtering events based on table name.
 * - Formatting and writing audit data to a file stream.
 * - Graceful shutdown handling to ensure the log file is closed properly.
 * - Robust error handling for both the stream and file I/O.
 *
 * To run this example:
 * 1. Ensure you have a PostgreSQL server with logical replication configured.
 * 2. Create a publication and a slot. For example:
 *    CREATE PUBLICATION my_audit_pub FOR TABLE users, products;
 *    SELECT pg_create_logical_replication_slot('audit_slot', 'pgoutput');
 * 3. Set up your environment variables (e.g., in a .env file and use `node --env-file=.env ...`):
 *    PGHOST=localhost
 *    PGPORT=5432
 *    PGUSER=replication_user
 *    PGPASSWORD=your_password
 *    PGDATABASE=your_db
 * 4. Run the script:
 *    node examples/audit-trail-builder.js
 */

import { createWriteStream } from 'node:fs';
import { PgLogicalStream } from '../src/index.js';

// --- Configuration ---

// Tables to monitor for changes. Use the format 'schema.table'.
const MONITORED_TABLES = new Set(['public.users', 'public.products']);

// Path for the audit log file.
const AUDIT_LOG_FILE = 'audit.log';

// PostgreSQL connection details from environment variables.
// See README for required user permissions.
const connectionOptions = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
};

// Replication slot and publication names.
const SLOT_NAME = 'audit_slot';
const PUBLICATION_NAME = 'my_audit_pub';

/**
 * Formats a DML event message into a standardized audit log entry.
 * @param {object} message - The parsed DML message from the stream.
 * @returns {string} A single-line, JSON-formatted string for the audit log.
 */
function formatAuditEntry(message) {
  const entry = {
    timestamp: new Date().toISOString(),
    operation: message.tag.toUpperCase(),
    schema: message.schema,
    table: message.table,
    data: {},
  };

  switch (message.tag) {
    case 'insert':
      entry.data.new = message.new;
      break;
    case 'update':
      entry.data.old = message.old;
      entry.data.new = message.new;
      break;
    case 'delete':
      entry.data.old = message.old;
      break;
    default:
      // Should not be reached if used correctly
      return null;
  }

  return JSON.stringify(entry);
}

/**
 * Main function to set up and run the audit trail builder.
 */
async function main() {
  console.log(`Starting audit trail builder...`);
  console.log(`Monitoring tables: ${[...MONITORED_TABLES].join(', ')}`);
  console.log(`Writing audit logs to: ${AUDIT_LOG_FILE}`);

  // Create a writable stream for the audit log file.
  // Using a stream is efficient for writing a large number of log entries.
  const logFileStream = createWriteStream(AUDIT_LOG_FILE, { flags: 'a' });

  logFileStream.on('error', (err) => {
    console.error(`Fatal error writing to audit log file "${AUDIT_LOG_FILE}":`, err);
    // In a production system, you might want to stop the application
    // or switch to a fallback logging mechanism.
    process.exit(1);
  });

  // Instantiate the logical replication client.
  const client = new PgLogicalStream({
    connection: connectionOptions,
    slotName: SLOT_NAME,
    publicationName: PUBLICATION_NAME,
  });

  // --- Event Listeners ---

  client.on('connect', () => {
    console.log(`Successfully connected to PostgreSQL. Streaming changes from slot "${SLOT_NAME}".`);
  });

  client.on('error', (error) => {
    console.error('An error occurred with the replication stream:', error.message);
    // The client will attempt to shut down gracefully on connection errors.
  });

  client.on('close', () => {
    console.log('Replication stream closed.');
    // Ensure the file stream is closed when the replication client closes.
    logFileStream.end(() => {
      console.log(`Audit log file "${AUDIT_LOG_FILE}" closed.`);
    });
  });

  // Listen for specific DML events.
  ['insert', 'update', 'delete'].forEach(eventName => {
    client.on(eventName, (message) => {
      const qualifiedTableName = `${message.schema}.${message.table}`;

      // Filter for events on monitored tables.
      if (MONITORED_TABLES.has(qualifiedTableName)) {
        const logEntry = formatAuditEntry(message);
        if (logEntry) {
          logFileStream.write(logEntry + '\n');
        }
      }
    });
  });

  // --- Graceful Shutdown ---

  const shutdown = async () => {
    console.log('\nReceived shutdown signal. Stopping client gracefully...');
    try {
      await client.stop();
      console.log('Client stopped.');
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    } finally {
      // The 'close' event on the client will handle closing the file stream.
    }
  };

  process.on('SIGINT', shutdown); // Catches Ctrl+C
  process.on('SIGTERM', shutdown); // Catches kill signals

  // --- Start the Client ---

  try {
    await client.start();
    console.log('Client started successfully. Waiting for database changes...');
  } catch (error) {
    console.error('Failed to start replication client:', error.message);
    logFileStream.end(); // Ensure file is closed on startup failure
    process.exit(1);
  }
}

// Run the main function and handle any top-level unhandled promise rejections.
main().catch((err) => {
  console.error('An unexpected error occurred in the main execution block:', err);
  process.exit(1);
});