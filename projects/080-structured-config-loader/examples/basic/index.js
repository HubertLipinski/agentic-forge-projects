'use strict';

/**
 * @fileoverview Basic usage example for the structured-config-loader.
 *
 * This script demonstrates how to:
 * 1. Import the main `loadConfig` function.
 * 2. Import a JSON schema for validation.
 * 3. Define the locations of configuration files (`.env`, `.yaml`).
 * 4. Call `loadConfig` with options to load from all sources:
 *    - Files (config.yaml)
 *    - Environment variables (from .env and process.env, with a prefix)
 *    - Command-line arguments (parsed via yargs-parser)
 * 5. Handle success and error cases, printing the final configuration or the error details.
 *
 * To run this example, use the npm script defined in `package.json`:
 *
 *   npm run example:basic
 *
 * This command executes:
 *   node examples/basic/index.js --port=9090 --log.level=debug --features.beta.enabled=true
 *
 * The expected outcome is a merged configuration object where:
 * - `server.port` is `9090` (from command-line arguments, highest priority).
 * - `log.level` is `debug` (from command-line arguments).
 * - `features.beta.enabled` is `true` (from command-line arguments).
 * - `database.password` is `'env_secret_password'` (from the .env file).
 * - `server.host` is `'0.0.0.0'` (from config.yaml).
 * - The final object is validated against the schema and is immutable.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../../src/index.js';
import schema from './config.schema.json' assert { type: 'json' };

// Helper to get the directory name in ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * An asynchronous main function to demonstrate configuration loading.
 */
async function main() {
  console.log('Attempting to load application configuration...');

  try {
    // Define the configuration sources and options.
    // The `loadConfig` function will automatically discover and merge them
    // according to the default priority: ARGV > ENV > FILE > DEFAULTS.
    const config = await loadConfig({
      // 1. Schema: For validation, default values, and type coercion.
      schema,

      // 2. Files: Explicitly define which files to load.
      // The loader merges them in the order provided.
      files: [
        resolve(__dirname, 'config.yaml'),
        // You could add more files here, e.g., 'config.local.yaml'
      ],

      // 3. Environment Variables: Enable and configure ENV var parsing.
      env: {
        // Look for variables prefixed with 'APP_'.
        prefix: 'APP',
        // Use '__' as the separator for nested keys (e.g., APP_DATABASE__USER).
        separator: '__',
        // Specify the path to the .env file.
        files: [resolve(__dirname, '.env')],
      },

      // 4. Command-line Arguments: Enable argv parsing.
      // `yargs-parser` will automatically handle --dot.notation.
      argv: true,
    });

    console.log('\n✅ Configuration loaded successfully!');
    console.log('Final configuration object:');
    // Using console.dir for better object inspection.
    console.dir(config, { depth: null });

    // Demonstrate that the returned object is immutable.
    // This will throw a TypeError in strict mode.
    try {
      config.server.port = 3000;
    } catch (error) {
      console.log('\n💡 As expected, attempting to mutate the config object failed:');
      console.error(`   ${error.name}: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Failed to load configuration.');
    console.error(`Error: ${error.message}`);

    // For validation errors, print the detailed list of issues.
    if (error.name === 'ConfigValidationError' && error.errors) {
      console.error('Validation details:');
      for (const validationError of error.errors) {
        const path = validationError.instancePath || '(root)';
        console.error(`  - Path: ${path}, Message: ${validationError.message}`);
      }
    } else if (error.cause) {
      // Print the underlying cause if available.
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Execute the main function.
main();