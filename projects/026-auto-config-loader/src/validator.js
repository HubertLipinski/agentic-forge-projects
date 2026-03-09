/**
 * @file src/validator.js
 * @description Provides optional schema validation for the final configuration object.
 *              It checks for required fields and correct data types based on a
 *              user-provided schema object.
 */

/**
 * Custom error class for configuration validation failures.
 * This allows consumers to specifically catch validation-related errors.
 */
export class ConfigValidationError extends Error {
  /**
   * @param {string} message The overall error message.
   * @param {string[]} [errors=[]] A list of specific validation error details.
   */
  constructor(message, errors = []) {
    super(message);
    this.name = 'ConfigValidationError';
    this.errors = errors;
    // For better error reporting, combine individual errors into the main message.
    if (errors.length > 0) {
      this.message += `\n- ${errors.join('\n- ')}`;
    }
  }
}

/**
 * Determines the JavaScript type of a value. Extends `typeof` to correctly
 * identify `null` and `array`.
 *
 * @param {any} value The value to check.
 * @returns {string} The type of the value (e.g., 'string', 'number', 'object', 'array', 'null').
 */
function getType(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

/**
 * Recursively validates a configuration object against a schema object.
 *
 * The schema object mirrors the structure of the configuration. Each property
 * in the schema can be an object with `type` and `required` fields, or a
 * nested schema object.
 *
 * @example
 * const schema = {
 *   database: {
 *     host: { type: 'string', required: true },
 *     port: { type: 'number', required: false },
 *     credentials: {
 *       user: { type: 'string', required: true }
 *     }
 *   }
 * };
 *
 * @param {object} config The configuration object to validate.
 * @param {object} schema The schema to validate against.
 * @param {string} [parentPath=''] The dot-notation path for tracking nested keys.
 * @returns {string[]} An array of error messages. An empty array indicates success.
 */
function validateNode(config, schema, parentPath = '') {
  const errors = [];

  // If the schema itself is invalid (not an object), we cannot proceed.
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    errors.push(`Invalid schema definition at path: '${parentPath || '(root)'}'. Schema must be an object.`);
    return errors;
  }

  for (const key in schema) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const schemaNode = schema[key];
    const configValue = config?.[key];
    const valueExists = configValue !== undefined;

    // A schema node must be an object.
    if (schemaNode === null || typeof schemaNode !== 'object' || Array.isArray(schemaNode)) {
      errors.push(`Invalid schema definition for '${currentPath}'. Expected an object, but got ${getType(schemaNode)}.`);
      continue;
    }

    const { type, required } = schemaNode;

    // Case 1: The schema node defines a type and requirement (leaf node).
    if (typeof type === 'string') {
      // Check for required fields.
      if (required === true && !valueExists) {
        errors.push(`Missing required configuration key: '${currentPath}'.`);
        continue; // No further checks needed for this key.
      }

      // If the value exists, check its type.
      if (valueExists) {
        const actualType = getType(configValue);
        if (actualType !== type) {
          errors.push(`Invalid type for configuration key: '${currentPath}'. Expected ${type}, but got ${actualType}.`);
        }
      }
    }
    // Case 2: The schema node is a nested object (branch node).
    else {
      // If the corresponding config part is required but missing or not an object, report error.
      if (required === true && (!valueExists || getType(configValue) !== 'object')) {
        errors.push(`Missing or invalid configuration object for required key: '${currentPath}'.`);
        continue;
      }

      // If the config part exists and is an object, recurse into it.
      if (valueExists && getType(configValue) === 'object') {
        const nestedErrors = validateNode(configValue, schemaNode, currentPath);
        errors.push(...nestedErrors);
      }
    }
  }

  return errors;
}

/**
 * Validates a configuration object against a user-provided schema.
 * Throws a `ConfigValidationError` if validation fails.
 *
 * @param {object} config The final, merged configuration object.
 * @param {object} schema The schema object to validate against.
 * @throws {ConfigValidationError} If the configuration does not match the schema.
 */
export function validateConfig(config, schema) {
  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    // If no schema is provided, validation is skipped.
    return;
  }

  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Invalid configuration provided for validation. Expected an object.');
  }

  const errors = validateNode(config, schema);

  if (errors.length > 0) {
    throw new ConfigValidationError('Configuration validation failed.', errors);
  }
}