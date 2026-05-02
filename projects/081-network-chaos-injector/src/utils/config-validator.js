/**
 * @file src/utils/config-validator.js
 * @description A simple schema validator for chaos configuration objects.
 * This validator ensures that the configuration provided to the injector
 * (either programmatically or via a config file) adheres to the expected structure.
 * It does not use external validation libraries to keep dependencies minimal.
 */

/**
 * Custom error class for configuration validation failures.
 * This allows consumers to specifically catch validation errors.
 */
export class ConfigValidationError extends Error {
  /**
   * @param {string} message - The validation error message.
   * @param {string} [path] - The dot-notation path to the invalid property.
   */
  constructor(message, path) {
    const fullMessage = path ? `Invalid configuration at '${path}': ${message}` : `Invalid configuration: ${message}`;
    super(fullMessage);
    this.name = 'ConfigValidationError';
    this.path = path;
  }
}

/**
 * Validates a single rule object within the configuration.
 * @param {any} rule - The rule object to validate.
 * @param {string} path - The current validation path for error reporting.
 * @throws {ConfigValidationError} if the rule is invalid.
 */
function validateRule(rule, path) {
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    throw new ConfigValidationError('Rule must be a non-null object.', path);
  }

  // Validate 'target'
  const targetPath = `${path}.target`;
  if (!('target' in rule)) {
    throw new ConfigValidationError("Rule must have a 'target' property.", path);
  }
  if (typeof rule.target !== 'object' || rule.target === null) {
    throw new ConfigValidationError("Property 'target' must be an object.", targetPath);
  }

  const { host, method, path: urlPath } = rule.target;
  if (host !== undefined && typeof host !== 'string' && !(host instanceof RegExp)) {
    throw new ConfigValidationError("Target 'host' must be a string or a RegExp.", `${targetPath}.host`);
  }
  if (method !== undefined && typeof method !== 'string' && !(method instanceof RegExp)) {
    throw new ConfigValidationError("Target 'method' must be a string or a RegExp.", `${targetPath}.method`);
  }
  if (urlPath !== undefined && typeof urlPath !== 'string' && !(urlPath instanceof RegExp)) {
    throw new ConfigValidationError("Target 'path' must be a string or a RegExp.", `${targetPath}.path`);
  }

  // Validate 'scenario'
  const scenarioPath = `${path}.scenario`;
  if (!('scenario' in rule)) {
    throw new ConfigValidationError("Rule must have a 'scenario' property.", path);
  }
  if (typeof rule.scenario !== 'object' || rule.scenario === null) {
    throw new ConfigValidationError("Property 'scenario' must be an object.", scenarioPath);
  }

  const { type, options } = rule.scenario;
  if (typeof type !== 'string' || !type) {
    throw new ConfigValidationError("Scenario 'type' must be a non-empty string.", `${scenarioPath}.type`);
  }

  if (options !== undefined && (typeof options !== 'object' || options === null)) {
    throw new ConfigValidationError("Scenario 'options' must be an object if provided.", `${scenarioPath}.options`);
  }

  // Validate 'probability'
  if (rule.probability !== undefined) {
    if (typeof rule.probability !== 'number' || rule.probability < 0 || rule.probability > 1) {
      throw new ConfigValidationError("Property 'probability' must be a number between 0 and 1.", `${path}.probability`);
    }
  }
}

/**
 * Validates the main chaos configuration object.
 * The configuration should be an object with a `rules` property, which is an array of rule objects.
 *
 * @param {any} config - The configuration object to validate.
 * @returns {{isValid: true, error: null} | {isValid: false, error: ConfigValidationError}}
 *          An object indicating the validation result.
 */
export function validateConfig(config) {
  try {
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new ConfigValidationError('Configuration must be a non-null object.', 'root');
    }

    if (!('rules' in config)) {
      throw new ConfigValidationError("Configuration must have a 'rules' property.", 'root');
    }

    if (!Array.isArray(config.rules)) {
      throw new ConfigValidationError("Property 'rules' must be an array.", 'rules');
    }

    if (config.rules.length === 0) {
      // An empty rules array is valid, but might be unintentional.
      // We'll allow it, as it's a "do nothing" configuration.
      // A warning could be logged by the consumer if desired.
    }

    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];
      const rulePath = `rules[${i}]`;
      validateRule(rule, rulePath);
    }

    return { isValid: true, error: null };
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return { isValid: false, error };
    }
    // Re-throw unexpected errors
    throw error;
  }
}