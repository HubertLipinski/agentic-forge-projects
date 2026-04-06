/**
 * @file src/commands/diff.js
 * @description Yargs command module for the `diff` command.
 *
 * This command reads two schema snapshot files, compares them, and prints a
 * human-readable summary of the differences to the console. It is the
 * primary tool for identifying schema drift between environments or over time.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { diffSchemas } from '../snapshot-differ.js';

/**
 * The command's name.
 * @type {string}
 */
export const command = 'diff <file1> <file2>';

/**
 * A short description of the command.
 * @type {string}
 */
export const describe = 'Compare two schema snapshot files and show the differences';

/**
 * Configures the command's options and arguments.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export const builder = (yargs) => {
  return yargs
    .positional('file1', {
      describe: 'Path to the first (source/old) snapshot file.',
      type: 'string',
      normalize: true,
    })
    .positional('file2', {
      describe: 'Path to the second (target/new) snapshot file.',
      type: 'string',
      normalize: true,
    })
    .check((argv) => {
      if (!argv.file1 || !argv.file2) {
        throw new Error('Error: Both file paths must be provided.');
      }
      if (argv.file1 === argv.file2) {
        throw new Error('Error: The two file paths cannot be the same.');
      }
      return true;
    });
};

/**
 * Reads and parses a JSON snapshot file.
 *
 * @param {string} filePath - The path to the snapshot file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON object.
 * @throws {Error} If the file cannot be read or parsed.
 */
const readSnapshotFile = async (filePath) => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  let fileContent;

  try {
    fileContent = await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${absolutePath}`);
    }
    throw new Error(`Failed to read file: ${absolutePath}. Reason: ${error.message}`);
  }

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON from file: ${absolutePath}. Reason: ${error.message}`);
  }
};

/**
 * The main logic for the `diff` command.
 *
 * It performs the following steps:
 * 1. Reads and parses the two specified snapshot files.
 * 2. Invokes the `snapshot-differ` to compute the differences.
 * 3. Prints the resulting diff summary to the console.
 * 4. Exits with a non-zero status code if differences are found,
 *    which is useful for CI/CD pipelines.
 *
 * @param {object} argv - The parsed command-line arguments.
 * @param {string} argv.file1 - Path to the first snapshot file.
 * @param {string} argv.file2 - Path to the second snapshot file.
 */
export const handler = async (argv) => {
  const { file1, file2 } = argv;

  console.error(`Comparing schema snapshots:`);
  console.error(`  - Source: ${file1}`);
  console.error(`  - Target: ${file2}\n`);

  try {
    const [snapshot1, snapshot2] = await Promise.all([
      readSnapshotFile(file1),
      readSnapshotFile(file2),
    ]);

    const differences = diffSchemas(snapshot1, snapshot2);

    if (differences.length === 0) {
      console.log('✅ No differences found. Schemas are identical.');
      process.exit(0);
    }

    console.log('⚠️ Schema differences detected:\n');
    differences.forEach((diff) => console.log(diff));
    console.log(`\nFound ${differences.length} difference(s).`);

    // Exit with a non-zero status code to indicate changes were found.
    // This is a common pattern for `diff` tools in CI/CD environments.
    process.exit(1);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(2); // Use a different exit code for operational errors vs. diffs found.
  }
};