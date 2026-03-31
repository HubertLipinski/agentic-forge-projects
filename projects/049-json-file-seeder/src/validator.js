/**
 * @file src/validator.js
 * @description A module that uses 'ajv' to compile a JSON schema and validate data records against it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import logger from './utils/logger.js';

/**
 * An instance of Ajv, configured for our validation needs.
 * We initialize it once and reuse it for performance, as compiling schemas can be expensive.
 * `allErrors: true` collects all validation errors, not just the first one.
 * @type {Ajv}
 */
const ajv = new Ajv({ allErrors: true });

/**
 * A cache to store compiled validation functions.
 * The key is the absolute path to the schema file, and the value is the compiled
 * validation function from Ajv. This avoids re-reading and re-compiling the same schema.
 * @type {Map<string, import('ajv').ValidateFunction>}
 */
const validatorCache = new Map();

/**
 * Loads a JSON schema from a file, parses it, and compiles it using Ajv.
 * The compiled function is cached to avoid redundant file I/O and compilation.
 *
 * @param {string} schemaPath - The file path to the JSON schema.
 * @returns {Promise<import('ajv').ValidateFunction | null>} A compiled validation function, or null if loading/compilation fails.
 */
async function getValidator(schemaPath) {
  const absolutePath = path.resolve(schemaPath);

  // Return the cached validator if it exists.
  if (validatorCache.has(absolutePath)) {
    return validatorCache.get(absolutePath);
  }

  try {
    const schemaContent = await fs.readFile(absolutePath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    const validate = ajv.compile(schema);

    // Cache the compiled function for future use.
    validatorCache.set(absolutePath, validate);
    logger.info(`Successfully loaded and compiled schema: ${absolutePath}`);
    return validate;
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.error(`Schema parsing error in ${absolutePath}: ${error.message}`);
    } else if (error.code === 'ENOENT') {
      logger.error(`Schema file not found: ${absolutePath}`);
    } else {
      // This could be an Ajv compilation error or a file system read error.
      logger.error(`Failed to load or compile schema from ${absolutePath}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Formats Ajv validation errors into a human-readable string.
 *
 * @param {import('ajv').ErrorObject[]} errors - An array of error objects from Ajv.
 * @returns {string} A formatted string detailing the validation errors.
 */
function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'No validation errors found.';
  }

  return errors
    .map(error => {
      const instancePath = error.instancePath ? `at '${error.instancePath}'` : '';
      return `- ${instancePath} ${error.message}`;
    })
    .join('\n  ');
}

/**
 * Validates a single data record against a compiled validation function.
 *
 * @param {object} record - The data object to validate.
 * @param {import('ajv').ValidateFunction} validateFn - The compiled Ajv validation function.
 * @returns {boolean} `true` if the record is valid, `false` otherwise.
 */
function validateRecord(record, validateFn) {
  const isValid = validateFn(record);
  if (!isValid) {
    const errorDetails = formatValidationErrors(validateFn.errors);
    logger.warn(`Record validation failed:\n  ${errorDetails}`);
  }
  return isValid;
}

export { getValidator, validateRecord };