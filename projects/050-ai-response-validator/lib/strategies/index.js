/**
 * @file lib/strategies/index.js
 * @description Factory module to retrieve a validation strategy instance based on configuration.
 * @module lib/strategies/index
 */

import { JsonValidator } from './json-validator.js';
import { XmlValidator } from './xml-validator.js';
import { RegexValidator } from './regex-validator.js';
import { ValidationError } from '../errors.js';
import { VALIDATION_STRATEGIES } from '../constants.js';

/**
 * A map of available validation strategy names to their corresponding
 * validator classes. This allows for dynamic instantiation of validators.
 *
 * To add a new custom strategy, import its class and add it to this map.
 * The key should be the strategy's unique `name` identifier.
 *
 * @private
 * @type {Map<string, Function>}
 */
const strategyRegistry = new Map([
  [JsonValidator.name, JsonValidator],
  [XmlValidator.name, XmlValidator],
  [RegexValidator.name, RegexValidator],
]);

/**
 * A set of all available strategy names, derived from the registry.
 * Used for validation and error messages.
 * @private
 * @type {Set<string>}
 */
const availableStrategies = new Set(strategyRegistry.keys());

/**
 * Factory function to create and retrieve a validation strategy instance.
 *
 * This function looks up the requested strategy by name in the registry,
 * instantiates it with the provided options, and returns the instance.
 * It serves as a central point for accessing all validation logic.
 *
 * @param {string} name - The name of the strategy to create. Must be one of
 *   the keys in `VALIDATION_STRATEGIES` (e.g., 'json', 'xml', 'regex').
 * @param {object} [options={}] - The configuration options to pass to the
 *   strategy's constructor. The required options depend on the chosen strategy
 *   (e.g., `schema` for 'json', `pattern` for 'regex').
 * @returns {JsonValidator | XmlValidator | RegexValidator} An instance of the requested validation strategy.
 * @throws {ValidationError} If the strategy name is not recognized or if the
 *   strategy's constructor throws an error due to invalid options.
 *
 * @example
 * // Get a JSON validator with a schema
 * const jsonStrategy = getStrategy('json', { schema: { type: 'object' } });
 *
 * // Get a Regex validator with a pattern
 * const regexStrategy = getStrategy('regex', { pattern: /^\d{4}-\d{2}-\d{2}$/ });
 */
export function getStrategy(name, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError(
      'A strategy name (string) must be provided.',
      { details: { available: Array.from(availableStrategies) } },
    );
  }

  const StrategyClass = strategyRegistry.get(name);

  if (!StrategyClass) {
    throw new ValidationError(
      `Unknown validation strategy: "${name}". Available strategies are: ${Array.from(availableStrategies).join(', ')}.`,
      { details: { requested: name, available: Array.from(availableStrategies) } },
    );
  }

  try {
    return new StrategyClass(options);
  } catch (error) {
    // If the strategy constructor throws (e.g., invalid regex pattern, bad schema),
    // re-throw it as a ValidationError to maintain a consistent error type.
    // We check if it's already a ValidationError to avoid double-wrapping.
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Failed to initialize strategy "${name}": ${error.message}`,
      { cause: error },
    );
  }
}

/**
 * Registers a new custom validation strategy or overwrites an existing one.
 * This allows users to extend the library with their own validation logic.
 *
 * The provided class must have a static `name` property that serves as its
 * unique identifier and an async `validate` method.
 *
 * @param {Function} StrategyClass - The constructor of the custom strategy class.
 *   It must have a static `name` property (string) and an async `validate` method.
 * @throws {ValidationError} If the class is invalid (e.g., missing static `name`).
 *
 * @example
 * class CsvValidator {
 *   static name = 'csv';
 *   constructor(options) {
 *     // ...
 *   }
 *   async validate(response) {
 *     // ... validation logic
 *   }
 * }
 *
 * registerStrategy(CsvValidator);
 * const csvStrategy = getStrategy('csv', { headers: true });
 */
export function registerStrategy(StrategyClass) {
  if (typeof StrategyClass !== 'function' || !StrategyClass.name) {
    throw new ValidationError(
      'Invalid strategy class provided. It must be a class with a static `name` property.',
    );
  }

  if (typeof StrategyClass.prototype.validate !== 'function') {
    throw new ValidationError(
        `Invalid strategy class "${StrategyClass.name}". It must have a 'validate' method on its prototype.`,
    );
  }

  strategyRegistry.set(StrategyClass.name, StrategyClass);
  availableStrategies.add(StrategyClass.name);
}

/**
 * Exports constants for consumption by other modules.
 */
export const STRATEGIES = VALIDATION_STRATEGIES;