'use strict';

/**
 * @fileoverview Provides a validation service for configuration objects using JSON Schema.
 * This module wraps the `ajv` library to offer a streamlined and consistent validation
 * interface, tailored for the needs of the structured-config-loader.
 *
 * @module src/validator
 */

import Ajv from 'ajv';
import { ConfigValidationError } from '../errors.js';

/**
 * Creates and configures an `Ajv` instance with sensible defaults for configuration validation.
 *
 * The configuration includes:
 * - `allErrors: true`: Gathers all validation errors, not just the first one.
 * - `coerceTypes: true`: Automatically coerces data types to match the schema's `type` keyword.
 *   This is crucial for handling values from environment variables and command-line arguments,
 *   which are initially strings (e.g., '123' becomes 123 if the schema expects a number).
 * - `useDefaults: true`: Applies default values from the schema to the configuration data.
 *   This allows for a more complete and predictable configuration object.
 *
 * @returns {Ajv} A configured `Ajv` instance.
 */
function createAjvInstance() {
  return new Ajv({
    allErrors: true, // Report all errors, not just the first
    coerceTypes: true, // Coerce types of data to match schema
    useDefaults: true, // Apply defaults from schema
  });
}

/**
 * Validates a configuration object against a given JSON Schema.
 *
 * If a schema is not provided, the function returns immediately, treating validation as a no-op.
 * This allows for optional validation. If the configuration is invalid, it throws a
 * `ConfigValidationError` that contains a detailed list of all validation failures.
 *
 * @param {object} config - The configuration object to be validated.
 * @param {object | null | undefined} schema - The JSON Schema to validate against. If null or undefined, no validation is performed.
 * @throws {ConfigValidationError} If the configuration object fails validation against the schema.
 * @returns {void}
 */
export function validateConfig(config, schema) {
  // If no schema is provided, validation is skipped.
  if (!schema) {
    return;
  }

  const ajv = createAjvInstance();
  const validate = ajv.compile(schema);
  const isValid = validate(config);

  if (isValid) {
    return;
  }

  // If validation fails, format the errors and throw a custom error.
  const errorMessages = (validate.errors ?? [])
    .map((error) => {
      const path = error.instancePath || '/';
      return `[${path}]: ${error.message}`;
    })
    .join('; ');

  const summary = `Configuration validation failed with ${
    validate.errors?.length ?? 0
  } error(s): ${errorMessages}`;

  throw new ConfigValidationError(summary, validate.errors ?? []);
}