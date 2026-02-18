import Ajv from 'ajv';
import pino from 'pino';

// Initialize a logger for this module to provide context in application logs.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    },
  },
}).child({ module: 'ajv-config' });

/**
 * Initializes and configures a singleton Ajv instance for JSON schema validation.
 *
 * This function encapsulates the creation of the Ajv validator, ensuring it is
 * configured consistently across the application. It's designed to be called
 * once during application startup.
 *
 * Configuration Details:
 * - `allErrors: true`: Collects all validation errors, not just the first one. This provides more comprehensive feedback to clients.
 * - `coerceTypes: true`: Automatically converts data types to match the schema specification (e.g., string "5" to number 5). This is particularly useful for query string parameters which are always strings.
 * - `useDefaults: true`: Assigns default values from the schema to the data if properties are missing.
 * - `removeAdditional: 'all'`: Removes any properties in the data that are not defined in the schema. This helps enforce a strict contract and prevents unexpected data from flowing through the system.
 * - `strict: 'log'`: Enables strict mode, which logs warnings for any unknown keywords, formats, or other potential issues in the schemas themselves. This is invaluable for schema development and maintenance.
 *
 * @returns {Ajv} A pre-configured Ajv instance.
 */
function createAjvInstance() {
  try {
    const ajvInstance = new Ajv({
      allErrors: true, // Report all errors, not just the first
      coerceTypes: true, // Coerce types to what the schema expects
      useDefaults: true, // Add default values where specified
      removeAdditional: 'all', // Remove properties not defined in the schema
      strict: 'log', // Log warnings for strict mode violations (e.g., unknown keywords)
      logger: {
        log: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
      },
    });

    logger.info('Ajv instance created with recommended production settings.');
    return ajvInstance;
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize Ajv. This is a critical error.');
    // This is a non-recoverable error during startup.
    process.exit(1);
  }
}

/**
 * A shared, pre-configured Ajv instance for use throughout the application.
 * This singleton instance ensures consistent validation behavior and avoids
 * the overhead of re-creating and re-compiling schemas.
 *
 * @type {Ajv}
 */
const ajv = createAjvInstance();

export default ajv;