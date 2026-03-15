import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ajvErrors from 'ajv-errors';
import configSchema from './schema.js';

/**
 * @file src/config/validator.js
 * @description A module that uses Ajv and the schema to validate a user-provided configuration object.
 * It provides detailed, user-friendly error messages upon validation failure.
 */

/**
 * A custom error class for configuration validation failures.
 * This allows for structured error handling upstream.
 */
class ConfigValidationError extends Error {
  /**
   * @param {string} message - A summary error message.
   * @param {import('ajv').ErrorObject[]} [errors] - The detailed error objects from Ajv.
   */
  constructor(message, errors = []) {
    super(message);
    this.name = 'ConfigValidationError';
    this.details = errors;
  }
}

/**
 * Formats Ajv validation errors into a single, readable string.
 *
 * @param {import('ajv').ErrorObject[]} errors - An array of error objects from Ajv's `validate.errors`.
 * @returns {string} A formatted, multi-line string describing the validation errors.
 */
const formatErrors = (errors) => {
  if (!errors || errors.length === 0) {
    return 'An unknown validation error occurred.';
  }

  const errorMessages = errors.map((error) => {
    const instancePath = error.instancePath ? ` at '${error.instancePath}'` : '';
    // ajv-errors provides a user-friendly message, which we prefer.
    // Fallback to a more generic message if it's not available.
    const message = error.message || `failed schema validation for keyword '${error.keyword}'.`;
    return `  - Configuration error${instancePath}: ${message}`;
  });

  return `Configuration validation failed with the following errors:\n${errorMessages.join('\n')}`;
};

// Initialize and configure a single Ajv instance for the module.
// This is more performant than creating a new instance for each validation.
const ajv = new Ajv({
  allErrors: true, // Collect all errors, not just the first one
  useDefaults: true, // Apply default values from the schema
  coerceTypes: true, // Coerce data types to match the schema
});

// Enhance Ajv with support for formats like 'uri'
addFormats(ajv);

// Enhance Ajv with custom error message support from the schema's 'errorMessage' keywords
ajvErrors(ajv);

// Compile the schema once for efficiency. The returned function can be reused.
const validate = ajv.compile(configSchema);

/**
 * Validates a given configuration object against the predefined JSON schema.
 *
 * It performs a deep clone of the input configuration to avoid side effects
 * from Ajv's type coercion and default value application. If validation fails,
 * it throws a `ConfigValidationError` with a formatted, user-friendly message.
 *
 * @param {object} config - The configuration object to validate.
 * @returns {object} The validated configuration object, potentially with defaults applied.
 * @throws {ConfigValidationError} If the configuration object is invalid.
 */
const validateConfig = (config) => {
  // Deep clone the config to prevent Ajv from mutating the original object.
  // This is crucial because `useDefaults` and `coerceTypes` modify the object in-place.
  const configCopy = structuredClone(config);

  if (validate(configCopy)) {
    return configCopy; // Return the (potentially modified) valid config
  }

  // If validation fails, format the errors and throw a custom error.
  const formattedErrorMessage = formatErrors(validate.errors ?? []);
  throw new ConfigValidationError(formattedErrorMessage, validate.errors);
};

export { validateConfig, ConfigValidationError };