/**
 * @file src/index.js
 * @description Main application logic for the Env Template Generator.
 * This module orchestrates the file scanning, environment variable parsing,
 * and template writing processes. It serves as the core engine of the CLI tool,
 * taking configuration options and executing the generation workflow.
 */

import { findFiles } from './services/fileScanner.js';
import { extractEnvVars } from './services/envParser.js';
import { writeTemplateFile } from './services/templateWriter.js';
import {
  DEFAULT_OUTPUT_FILE,
  DEFAULT_SOURCE_PATTERN,
  DEFAULT_IGNORE_PATTERNS,
} from './utils/constants.js';

/**
 * Orchestrates the entire process of generating an environment template file.
 * It takes configuration options, scans for files, parses them for environment
 * variables, and writes the result to a template file.
 *
 * This function is designed to be the main entry point for the application's logic,
 * called by the CLI or potentially by other programmatic users.
 *
 * @async
 * @function generateEnvTemplate
 * @param {object} [options={}] - The configuration options for the generation process.
 * @param {string[]} [options.patterns=[DEFAULT_SOURCE_PATTERN]] - Glob patterns for source files.
 * @param {string} [options.outputPath=DEFAULT_OUTPUT_FILE] - Path for the output file.
 * @param {string[]} [options.ignore=DEFAULT_IGNORE_PATTERNS] - Glob patterns to ignore.
 * @param {boolean} [options.verbose=false] - If true, enables detailed logging.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 * @throws {Error} Throws an error if a critical step (file scanning or writing) fails.
 */
export async function generateEnvTemplate(options = {}) {
  const {
    patterns = [DEFAULT_SOURCE_PATTERN],
    outputPath = DEFAULT_OUTPUT_FILE,
    ignore = DEFAULT_IGNORE_PATTERNS,
    verbose = false,
  } = options;

  console.log('Starting environment template generation...');
  if (verbose) {
    console.log(`  - Source Patterns: ${patterns.join(', ')}`);
    console.log(`  - Ignore Patterns: ${ignore.join(', ')}`);
    console.log(`  - Output File: ${outputPath}`);
  }

  // Step 1: Find all relevant files based on glob patterns.
  // This step can throw, which will be caught by the caller (e.g., the CLI).
  console.log('\n🔍 Scanning for source files...');
  const filePaths = await findFiles({ patterns, ignore });

  if (filePaths.length === 0) {
    console.warn(
      '[Warning] No matching files found. Please check your source patterns.'
    );
    console.log('Generation finished with no files to process.');
    return;
  }

  if (verbose) {
    console.log(`  - Found ${filePaths.length} files to scan.`);
    filePaths.forEach(file => console.log(`    - ${file}`));
  } else {
    console.log(`Found ${filePaths.length} files to scan.`);
  }

  // Step 2: Parse the files to extract all unique environment variables.
  // This step is resilient to individual file read errors and will continue.
  console.log('\n⚙️  Parsing files for environment variables...');
  const envVars = await extractEnvVars(filePaths);

  if (envVars.length === 0) {
    console.warn(
      '[Warning] No environment variables (process.env.VAR) found in the scanned files.'
    );
    console.log('Generation finished with no variables to write.');
    return;
  }

  console.log(`Discovered ${envVars.length} unique environment variables.`);
  if (verbose) {
    console.log(`  - Variables: ${envVars.join(', ')}`);
  }

  // Step 3: Write the discovered variables to the template file.
  // This step can also throw if there are file system permission issues.
  console.log(`\n📝 Writing template file to: ${outputPath}`);
  await writeTemplateFile({ envVars, outputPath });

  console.log(
    `\n✅ Success! Template file generated at '${outputPath}'.`
  );
}