/**
 * @file src/commands/capture.js
 * @description Yargs command module for the `capture` command.
 *
 * This command connects to a PostgreSQL database, extracts its schema,
 * and saves the resulting structured JSON to a specified output file.
 * It orchestrates the core logic of the application: database connection,
 * schema extraction, and file output.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getClient, disconnectClient } from '../utils/db-client.js';
import { extractSchema } from '../schema-extractor.js';

/**
 * The command's name.
 * @type {string}
 */
export const command = 'capture [output]';

/**
 * A short description of the command.
 * @type {string}
 */
export const describe = 'Capture a snapshot of the database schema';

/**
 * Configures the command's options and arguments.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export const builder = (yargs) => {
  return yargs
    .positional('output', {
      describe: 'The path to the output JSON file for the schema snapshot.',
      type: 'string',
      default: `snapshot-${new Date().toISOString().split('T')[0]}.json`,
      normalize: true,
    })
    .option('schema', {
      alias: 's',
      type: 'array',
      describe: 'Database schemas to include in the snapshot (e.g., public).',
      default: ['public'],
      string: true, // Ensures single values are not treated as numbers
    })
    .option('exclude-schema', {
      alias: 'x',
      type: 'array',
      describe: 'Database schemas to exclude from the snapshot.',
      default: [],
      string: true,
    })
    .check((argv) => {
      if (!argv.output) {
        throw new Error('Error: The output file path cannot be empty.');
      }
      return true;
    });
};

/**
 * The main logic for the `capture` command.
 *
 * It performs the following steps:
 * 1. Establishes a connection to the PostgreSQL database.
 * 2. Calls the `schema-extractor` to get the structured schema JSON.
 * 3. Writes the JSON to the specified output file.
 * 4. Ensures the database client is disconnected, whether the process
 *    succeeds or fails.
 *
 * @param {object} argv - The parsed command-line arguments.
 * @param {string} argv.output - The path for the output snapshot file.
 * @param {string[]} argv.schema - Schemas to include.
 * @param {string[]} argv.excludeSchema - Schemas to exclude.
 */
export const handler = async (argv) => {
  const { output, schema: includeSchemas, excludeSchema } = argv;
  const absoluteOutputPath = path.resolve(process.cwd(), output);

  console.error(`Capturing schema snapshot...`);
  console.error(`  - Including schemas: ${includeSchemas.join(', ') || '(none)'}`);
  console.error(`  - Excluding schemas: ${excludeSchema.join(', ') || '(none)'}`);
  console.error(`  - Output file: ${absoluteOutputPath}`);

  try {
    const client = await getClient();
    const schemaSnapshot = await extractSchema(client, {
      includeSchemas,
      excludeSchemas: excludeSchema,
    });

    const jsonOutput = JSON.stringify(schemaSnapshot, null, 2);

    try {
      await writeFile(absoluteOutputPath, jsonOutput, 'utf8');
      console.error(
        `\n✅ Snapshot successfully captured and saved to ${absoluteOutputPath}`,
      );
    } catch (writeError) {
      console.error(`\n❌ Error: Failed to write snapshot to file: ${absoluteOutputPath}`);
      console.error(writeError.message);
      process.exit(1);
    }
  } catch (error) {
    // Error from getClient or extractSchema
    console.error(`\n❌ An unexpected error occurred during schema capture:`);
    console.error(error.message);
    process.exit(1);
  } finally {
    // Always attempt to disconnect the client to prevent hanging processes.
    await disconnectClient();
  }
};