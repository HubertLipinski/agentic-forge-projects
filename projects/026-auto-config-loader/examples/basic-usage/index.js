/**
 * @file examples/basic-usage/index.js
 * @description A simple example demonstrating how to use the auto-config-loader.
 *
 * To run this example:
 * 1. Navigate to the root of the `auto-config-loader` project.
 * 2. Run the command: `node examples/basic-usage/index.js`
 *
 * You can experiment by setting environment variables:
 * - `NODE_ENV=production node examples/basic-usage/index.js`
 * - `APP__SERVER__PORT=8080 node examples/basic-usage/index.js`
 * - `APP__FEATURE_FLAGS__ENABLE_NEW_DASHBOARD=true node examples/basic-usage/index.js`
 */

// Import the main function from the auto-config-loader package.
// In a real application, this would be: import loadConfig from 'auto-config-loader';
import loadConfig from '../../src/index.js';

/**
 * An example schema to validate the loaded configuration.
 * This ensures that critical configuration values are present and have the correct type.
 */
const configSchema = {
  server: {
    host: { type: 'string', required: true },
    port: { type: 'number', required: true },
    logLevel: { type: 'string', required: false },
  },
  database: {
    type: { type: 'string', required: true },
  },
  featureFlags: {
    enableNewDashboard: { type: 'boolean', required: false },
  },
};

/**
 * Main function to demonstrate loading and using the configuration.
 */
async function main() {
  console.log('Attempting to load application configuration...');

  try {
    // Call `loadConfig` with desired options.
    // - `startDir`: Where to begin searching for config files.
    // - `envPrefix`: Only load environment variables starting with 'APP__'.
    // - `schema`: Validate the final config against our schema.
    const config = await loadConfig({
      startDir: import.meta.dirname, // Search from this example's directory upwards.
      envPrefix: 'APP',
      envSeparator: '__',
      schema: configSchema,
    });

    console.log('\n✅ Configuration loaded successfully!');

    // --- Accessing Configuration Values ---

    // 1. Direct property access (since the Config object mirrors the data)
    console.log(`\n--- Direct Access ---`);
    console.log(`Server Host: ${config.server.host}`);
    console.log(`Server Port: ${config.server.port}`);

    // 2. Using the .get() method for nested properties and default values
    console.log(`\n--- Using config.get() ---`);
    console.log(`Database Type: ${config.get('database.type')}`);
    // Provide a default value if a key might be missing
    console.log(`Log Level: ${config.get('server.logLevel', 'warn')}`);
    console.log(`New Dashboard Feature: ${config.get('featureFlags.enableNewDashboard', false)}`);

    // Example of a missing value with a default fallback
    const nonExistentValue = config.get('services.payment.apiKey', 'default_api_key');
    console.log(`Missing Key (with default): ${nonExistentValue}`);

    // --- Displaying the final configuration ---
    // Note: The returned `config` is an instance of a class, not a plain object.
    // To see the raw data, we can convert it to a plain object.
    const plainConfigObject = { ...config };
    console.log('\n--- Final Merged Configuration ---');
    console.log(JSON.stringify(plainConfigObject, null, 2));

  } catch (error) {
    // If loading or validation fails, the error will be caught here.
    console.error('\n❌ Failed to initialize application due to a configuration error:');
    console.error(error);
    process.exit(1); // Exit with a non-zero code to indicate failure.
  }
}

// Execute the main function.
main();