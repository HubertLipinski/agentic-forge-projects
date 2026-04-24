#!/usr/bin/env node

/**
 * bin/pg-logical-stream-cli.js
 *
 * A CLI utility for inspecting PostgreSQL logical replication publications, slots,
 * and for tailing the raw replication stream for debugging purposes.
 *
 * This tool helps users verify their setup and diagnose issues without needing to
 * write a full client application.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import pg from 'pg';
import { PgLogicalStream } from '../src/client.js';
import { DEFAULTS } from '../src/constants.js';

/**
 * Creates a standard pg.Client for running regular SQL queries.
 * @param {object} options - Connection options from yargs.
 * @returns {pg.Client} A new pg.Client instance.
 */
function createStandardClient(options) {
  return new pg.Client({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.database,
  });
}

/**
 * Defines the common connection options for all commands.
 * @param {import('yargs').Argv} y - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
function connectionOptions(y) {
  return y
    .option('host', {
      alias: 'h',
      type: 'string',
      description: 'PostgreSQL server host',
      default: process.env.PGHOST || 'localhost',
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'PostgreSQL server port',
      default: process.env.PGPORT || DEFAULTS.PG_PORT,
    })
    .option('user', {
      alias: 'U',
      type: 'string',
      description: 'PostgreSQL user name',
      default: process.env.PGUSER || 'postgres',
    })
    .option('password', {
      alias: 'W',
      type: 'string',
      description: 'PostgreSQL user password',
      default: process.env.PGPASSWORD,
      demandOption: false, // Often handled by .pgpass
    })
    .option('database', {
      alias: 'd',
      type: 'string',
      description: 'PostgreSQL database name',
      default: process.env.PGDATABASE || 'postgres',
    });
}

/**
 * Command to list all available publications on the server.
 * @param {object} argv - The parsed command-line arguments.
 */
async function listPublications(argv) {
  const client = createStandardClient(argv);
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM pg_publication;');
    if (res.rows.length === 0) {
      console.log('No publications found.');
    } else {
      console.log('Available Publications:');
      console.table(res.rows);
    }
  } catch (error) {
    console.error(`Error listing publications: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Command to list all logical replication slots on the server.
 * @param {object} argv - The parsed command-line arguments.
 */
async function listSlots(argv) {
  const client = createStandardClient(argv);
  try {
    await client.connect();
    // pg_replication_slots is only visible to superusers or users with REPLICATION role
    const res = await client.query("SELECT slot_name, plugin, slot_type, active, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots WHERE slot_type = 'logical';");
    if (res.rows.length === 0) {
      console.log('No logical replication slots found.');
    } else {
      console.log('Logical Replication Slots:');
      console.table(res.rows);
    }
  } catch (error) {
    console.error(`Error listing slots: ${error.message}`);
    if (error.code === '42501') { // permission denied
      console.error('Hint: Ensure the user has sufficient privileges (e.g., REPLICATION role or superuser) to view pg_replication_slots.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Command to tail the replication stream and log all messages.
 * @param {object} argv - The parsed command-line arguments.
 */
async function tailStream(argv) {
  console.log(`Attempting to connect to slot "${argv.slot}" on publication "${argv.publication}"...`);

  const stream = new PgLogicalStream({
    connection: {
      host: argv.host,
      port: argv.port,
      user: argv.user,
      password: argv.password,
      database: argv.database,
    },
    slotName: argv.slot,
    publicationName: argv.publication,
  });

  stream.on('connect', () => {
    console.log('Connection successful. Tailing replication stream...');
    console.log('Press Ctrl+C to stop.');
  });

  stream.on('error', (error) => {
    console.error('A stream error occurred:', error.message);
    if (error.cause?.code) {
      console.error(`  PostgreSQL Error Code: ${error.cause.code}`);
    }
    if (error.cause?.routine) {
      console.error(`  Routine: ${error.cause.routine}`);
    }
    process.exit(1);
  });

  stream.on('close', () => {
    console.log('\nStream closed.');
  });

  stream.on('data', (message) => {
    const output = argv.json
      ? JSON.stringify(message, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value, 2)
      : message;

    console.log(output);
  });

  // Graceful shutdown
  const stopStream = async () => {
    console.log('\nGracefully shutting down...');
    await stream.stop();
  };

  process.on('SIGINT', stopStream);
  process.on('SIGTERM', stopStream);

  try {
    await stream.start();
  } catch (error) {
    // Errors during startup are caught here.
    // The 'error' event handler will have already logged the details.
    console.error('Failed to start the stream.');
  }
}

/**
 * Main function to set up and run the yargs CLI.
 */
function main() {
  yargs(hideBin(process.argv))
    .scriptName('pg-logical-stream-cli')
    .usage('$0 <command> [options]')
    .command(
      'publications',
      'List all publications on the server',
      connectionOptions,
      listPublications
    )
    .command(
      'slots',
      'List all logical replication slots on the server',
      connectionOptions,
      listSlots
    )
    .command(
      'tail',
      'Tail and print messages from a replication stream',
      (y) => {
        return connectionOptions(y)
          .option('slot', {
            alias: 's',
            type: 'string',
            description: 'Name of the logical replication slot',
            default: DEFAULTS.SLOT_NAME,
          })
          .option('publication', {
            alias: 'pub',
            type: 'string',
            description: 'Name of the publication to stream',
            default: DEFAULTS.PUBLICATION_NAME,
          })
          .option('json', {
            type: 'boolean',
            description: 'Output messages in JSON format',
            default: false,
          });
      },
      tailStream
    )
    .demandCommand(1, 'You must provide a valid command.')
    .help()
    .alias('help', 'H')
    .version(false) // Disable default version, or read from package.json
    .strict()
    .parse();
}

main();