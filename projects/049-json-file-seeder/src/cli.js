/**
 * @file src/cli.js
 * @description Handles command-line argument parsing using `yargs-parser` and orchestrates the seeding process based on user input.
 */

import parser from 'yargs-parser';
import { createClient } from './client-factory.js';
import { runSeeder } from './seeder.js';
import logger from './utils/logger.js';
import { readFileSync } from 'node:fs';

// Dynamically import package.json to read version and description.
// Using a JSON assertion and a try-catch block for robustness.
let pkg = { version: 'unknown', description: 'A JSON file seeder CLI.' };
try {
  pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
} catch (error) {
  logger.warn('Could not read package.json for version info.');
}

/**
 * Defines the configuration for command-line arguments using yargs-parser options.
 * This centralizes the definition of all available CLI flags and their aliases.
 * @see https://github.com/yargs/yargs-parser#configuration
 */
const yargsOptions = {
  alias: {
    path: ['p'],
    client: ['c'],
    connectionString: ['cs'],
    schema: ['s'],
    'dry-run': ['d'],
    help: ['h'],
    version: ['v'],
  },
  boolean: ['dry-run', 'help', 'version'],
  string: ['path', 'client', 'connectionString', 'schema'],
  configuration: {
    'strip-dashed': true, // a --dry-run flag becomes dryRun
  },
};

/**
 * Displays the help message for the CLI tool, including usage, options, and examples.
 */
function showHelp() {
  // Using console.log directly for clean, unformatted output.
  // eslint-disable-next-line no-console
  console.log(`
${pkg.description} (v${pkg.version})

Usage:
  json-file-seeder --path <dir|file> --client <type> --connectionString <string> [options]

Required Arguments:
  -p, --path              Path to a directory of JSON files or a single JSON file.
  -c, --client            Database client type. Supported: mongodb, postgres.
  --cs, --connectionString  Database connection string.

Optional Arguments:
  -s, --schema            Path to a JSON Schema file for record validation.
  -d, --dry-run           Simulate the process without writing to the database.
  -h, --help              Show this help message.
  -v, --version           Show the version number.

Examples:
  # Seed a MongoDB database from a directory
  json-file-seeder -p ./data -c mongodb --cs "mongodb://localhost:27017/mydb"

  # Seed a PostgreSQL database with validation and a dry run
  json-file-seeder \\
    --path ./data/users.json \\
    --client postgres \\
    --connectionString "postgresql://user:pass@localhost:5432/mydb" \\
    --schema ./schemas/user-schema.json \\
    --dry-run
`);
}

/**
 * Validates the parsed command-line arguments to ensure all required options are present.
 *
 * @param {object} args - The parsed arguments object from yargs-parser.
 * @returns {boolean} `true` if arguments are valid, `false` otherwise.
 */
function validateArgs(args) {
  const requiredArgs = ['path', 'client', 'connectionString'];
  const missingArgs = requiredArgs.filter(arg => !args[arg]);

  if (missingArgs.length > 0) {
    logger.error(`Missing required arguments: ${missingArgs.join(', ')}`);
    logger.info('Use --help for more information.');
    return false;
  }

  return true;
}

/**
 * The main entry point for the CLI application.
 * It parses arguments, validates them, and initiates the seeding process.
 *
 * @param {string[]} argv - The command-line arguments array, typically `process.argv.slice(2)`.
 * @returns {Promise<void>} A promise that resolves when the process is complete or rejects on error.
 */
export async function main(argv) {
  const args = parser(argv, yargsOptions);

  if (args.version) {
    // eslint-disable-next-line no-console
    console.log(pkg.version);
    return;
  }

  if (args.help || Object.keys(args).length <= 1) { // Show help if --help or no args
    showHelp();
    return;
  }

  if (!validateArgs(args)) {
    // Throw an error to indicate failure to the calling context.
    throw new Error('Invalid arguments provided.');
  }

  let dbClient;
  try {
    logger.info(`Initializing '${args.client}' client...`);
    // The factory handles unsupported client types.
    dbClient = createClient(args.client, args.connectionString);

    await dbClient.connect();

    await runSeeder({
      path: args.path,
      client: dbClient,
      dryRun: args.dryRun ?? false,
      schemaPath: args.schema,
    });
  } catch (error) {
    // Log the specific error, which might come from client creation, connection, or the seeder.
    // The logger will handle Error objects gracefully, including stack traces.
    logger.error(error);
    // Re-throw to ensure the process exits with a non-zero code.
    throw new Error('Seeding process failed.');
  } finally {
    if (dbClient) {
      // Ensure the database connection is always closed, even if errors occur.
      await dbClient.disconnect().catch(err => {
        logger.error('An error occurred during disconnection.');
        logger.error(err);
      });
    }
  }
}