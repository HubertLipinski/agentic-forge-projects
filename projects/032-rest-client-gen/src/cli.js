/**
 * @file src/cli.js
 * @description The main CLI entry point. Uses 'yargs' to define commands and arguments,
 * orchestrating the validation, generation, and writing process.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { validateConfig, ConfigValidationError } from './config/validator.js';
import { prepareTemplateData } from './generator/preparer.js';
import { generateClientCode } from './generator/engine.js';
import { writeGeneratedCode } from './writer.js';

/**
 * A custom error class for high-level CLI operation failures.
 * This helps distinguish operational errors (like file not found) from
 * internal errors (like validation or rendering failures).
 */
class CliError extends Error {
  /**
   * @param {string} message - A descriptive error message.
   * @param {Error} [cause] - The underlying error.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'CliError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Reads and parses the JSON configuration file from the given path.
 *
 * @param {string} configPath - The path to the JSON configuration file.
 * @returns {Promise<object>} The parsed JSON configuration object.
 * @throws {CliError} If the file cannot be read or is not valid JSON.
 */
async function readConfigFile(configPath) {
  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CliError(`Failed to parse JSON from "${configPath}". Please check for syntax errors.`, error);
    }
    if (error.code === 'ENOENT') {
      throw new CliError(`Configuration file not found at "${configPath}".`, error);
    }
    throw new CliError(`Failed to read configuration file "${configPath}".`, error);
  }
}

/**
 * The main orchestration function for the client generation process.
 * It chains together reading, validating, preparing, generating, and writing.
 *
 * @param {object} argv - The arguments object from yargs.
 * @param {string} argv.config - Path to the configuration file.
 * @param {string} argv.output - Path to the output file.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */
async function runGeneration(argv) {
  const { config: configPath, output: outputPath } = argv;

  console.log(`🚀 Starting REST client generation...`);
  console.log(`   - Config file: ${configPath}`);
  console.log(`   - Output file: ${outputPath}`);

  // 1. Read and Parse Config
  const rawConfig = await readConfigFile(configPath);

  // 2. Validate Config
  const validatedConfig = validateConfig(rawConfig);

  // 3. Prepare Data for Template
  const templateData = prepareTemplateData(validatedConfig, path.basename(configPath));

  // 4. Generate Code String
  const generatedCode = await generateClientCode(templateData);

  // 5. Write to File
  await writeGeneratedCode(outputPath, generatedCode);

  console.log(`✅ Success! Client generated at: ${outputPath}`);
}

/**
 * Sets up and executes the yargs-based command-line interface.
 *
 * @param {string[]} processArgs - The process arguments, typically `process.argv`.
 * @returns {Promise<void>}
 */
export async function main(processArgs) {
  const cli = yargs(hideBin(processArgs));

  cli
    .scriptName('rest-client-gen')
    .usage('Usage: $0 <command> [options]')
    .command(
      '$0 <config>',
      'Generate a REST client from a configuration file.',
      (yargs) => {
        yargs
          .positional('config', {
            describe: 'Path to the JSON configuration file (e.g., `api.config.json`)',
            type: 'string',
            normalize: true,
          })
          .option('output', {
            alias: 'o',
            describe: 'Path to the output file for the generated client',
            type: 'string',
            normalize: true,
          })
          .demandOption(['config'], 'Please provide a path to the configuration file.')
          .check((argv) => {
            // If output is not provided, derive it from the config file name.
            // e.g., 'github-api.config.json' -> 'github-api.client.js'
            if (!argv.output) {
              const configFileName = path.basename(argv.config, '.config.json');
              argv.output = path.join(path.dirname(argv.config), `${configFileName}.client.js`);
            }
            return true;
          });
      },
      async (argv) => {
        try {
          await runGeneration(argv);
        } catch (error) {
          console.error(`\n❌ Generation failed. An error occurred:`);

          // Handle known error types with specific formatting
          if (error instanceof ConfigValidationError) {
            // The validator already formats the error message nicely.
            console.error(error.message);
          } else if (error.name === 'PreparationError' || error.name === 'RenderError' || error instanceof CliError || error.name === 'FileWriteError') {
            console.error(`   - ${error.message}`);
            if (error.cause) {
              console.error(`   - Underlying cause: ${error.cause.message}`);
            }
          } else {
            // Handle unexpected errors
            console.error('An unexpected error occurred. Please see details below.');
            console.error(error);
          }

          process.exit(1);
        }
      }
    )
    .alias('h', 'help')
    .alias('v', 'version')
    .help()
    .strict() // Report errors for unknown options
    .fail((msg, err, yargs) => {
      // Custom failure handler for yargs parsing errors
      console.error('Error: Invalid command or arguments.\n');
      console.error(msg || err.message);
      console.error('\n' + yargs.help());
      process.exit(1);
    })
    .epilogue('For more information, find the documentation at https://github.com/your-username/rest-client-generator');

  // This triggers the parsing and execution.
  await cli.parseAsync();
}