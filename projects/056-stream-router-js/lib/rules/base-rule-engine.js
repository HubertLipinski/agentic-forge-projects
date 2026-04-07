/**
 * @file lib/rules/base-rule-engine.js
 * @description Abstract base class defining the interface for all rule engines.
 *
 * This class establishes the contract that all concrete rule engine implementations
 * (e.g., JSONPath, RegExp) must follow. It ensures that the core `StreamRouter`
 * can interact with any rule engine in a consistent manner.
 *
 * Concrete implementations must override the `evaluate` method.
 * Attempting to instantiate or use `BaseRuleEngine` directly will result in an error.
 */

import { ConfigurationError } from '../utils/errors.js';

/**
 * An abstract base class that defines the common interface for all rule engines.
 * Rule engines are responsible for evaluating a data chunk against a specific rule's criteria.
 *
 * @class BaseRuleEngine
 * @abstract
 */
export class BaseRuleEngine {
  /**
   * Creates an instance of BaseRuleEngine.
   *
   * @throws {ConfigurationError} if an attempt is made to instantiate this abstract class directly.
   */
  constructor() {
    if (this.constructor === BaseRuleEngine) {
      throw new ConfigurationError(
        'BaseRuleEngine is an abstract class and cannot be instantiated directly. Please use a concrete implementation like JSONPathRuleEngine or RegexRuleEngine.'
      );
    }
  }

  /**
   * Evaluates a given data chunk against a rule's expression.
   *
   * This is an abstract method and **must** be implemented by any concrete subclass.
   * The implementation should return `true` if the chunk matches the rule's expression,
   * and `false` otherwise. It can also throw an error if the evaluation fails for
   * a reason specific to the engine (e.g., data parsing error).
   *
   * @abstract
   * @param {any} chunk - The data chunk from the stream to be evaluated. This could be a Buffer, a string, or a parsed JavaScript object.
   * @param {string|object} expression - The rule expression to evaluate against the chunk (e.g., a JSONPath string or a RegExp object).
   * @returns {boolean} `true` if the chunk matches the rule, `false` otherwise.
   * @throws {Error} Subclasses may throw errors related to parsing or evaluation.
   */
  evaluate(chunk, expression) {
    // This check ensures that subclasses have correctly implemented the method.
    // It will only be reached if a subclass calls super.evaluate() without
    // providing its own implementation, or if the method is somehow called
    // on a base instance (which the constructor should prevent).
    throw new ConfigurationError(
      `The 'evaluate' method must be implemented by the concrete rule engine: ${this.constructor.name}.`
    );
  }
}