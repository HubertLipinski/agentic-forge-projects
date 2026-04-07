/**
 * @file lib/stream-router.js
 * @description The core Transform stream for routing data.
 * This module defines the `StreamRouter` class, which is a Node.js Transform stream.
 * It receives data from a single readable source, evaluates it against a set of
 * user-defined rules, and then writes the data to one or more matching destination
 * writable streams. It manages backpressure from destinations and provides metrics.
 */

import { Transform } from 'node:stream';
import {
  ConfigurationError,
  StreamProcessingError,
} from './utils/errors.js';
import { RuleValidator } from './rule-validator.js';
import { JSONPathRuleEngine } from './rules/jsonpath-rule-engine.js';
import { RegexRuleEngine } from './rules/regex-rule-engine.js';

/**
 * A map of rule types to their corresponding engine classes.
 * This allows for easy extension with new rule engines.
 * @private
 * @type {Map<string, import('./rules/base-rule-engine.js').BaseRuleEngine>}
 */
const ruleEngineMap = new Map([
  ['jsonpath', JSONPathRuleEngine],
  ['regex', RegexRuleEngine],
]);

/**
 * The core Transform stream that routes data based on a set of rules.
 *
 * StreamRouter receives chunks from a source readable stream, evaluates each chunk
 * against a list of rules, and writes the chunk to the destination streams of all
 * matching rules. It handles backpressure from slow destinations to prevent memory
 * overload and provides detailed metrics on data flow.
 *
 * @class StreamRouter
 * @extends {stream.Transform}
 */
export class StreamRouter extends Transform {
  /**
   * @private
   * @type {Array<object>}
   */
  #rules;

  /**
   * @private
   * @type {Map<string, import('./rules/base-rule-engine.js').BaseRuleEngine>}
   */
  #engines;

  /**
   * @private
   * @type {object}
   */
  #metrics;

  /**
   * @private
   * @type {boolean}
   */
  #stopOnFirstMatch;

  /**
   * @private
   * @type {import('stream').Writable | null}
   */
  #defaultDestination;

  /**
   * @private
   * @type {boolean}
   */
  #passThrough;

  /**
   * Creates an instance of StreamRouter.
   *
   * @param {object} options - Configuration options for the router.
   * @param {Array<object>} options.rules - An array of rule objects to configure the routing logic.
   * @param {boolean} [options.objectMode=false] - Whether the stream should operate in object mode.
   * @param {boolean} [options.stopOnFirstMatch=false] - If true, routing for a chunk stops after the first matching rule.
   * @param {import('stream').Writable} [options.defaultDestination=null] - A default writable stream for chunks that match no rules.
   * @param {boolean} [options.passThrough=false] - If true, all chunks are passed through the router's readable side, regardless of matches.
   * @throws {ConfigurationError} If the rules or options are invalid.
   */
  constructor({
    rules,
    objectMode = false,
    stopOnFirstMatch = false,
    defaultDestination = null,
    passThrough = false
  }) {
    super({ objectMode });

    this.#validateConstructorOptions({ rules, defaultDestination });

    this.#rules = rules;
    this.#stopOnFirstMatch = stopOnFirstMatch;
    this.#defaultDestination = defaultDestination;
    this.#passThrough = passThrough;
    this.#engines = this.#initializeEngines(rules);
    this.#metrics = this.#initializeMetrics(rules, defaultDestination);
  }

  /**
   * Validates the options passed to the constructor.
   * @private
   * @param {object} options - The constructor options.
   * @throws {ConfigurationError} for invalid configurations.
   */
  #validateConstructorOptions({ rules, defaultDestination }) {
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      throw new ConfigurationError('The "rules" option must be a non-empty array.');
    }

    const validator = new RuleValidator();
    validator.validate(rules); // Throws RuleValidationError on failure

    if (defaultDestination && typeof defaultDestination.write !== 'function') {
      throw new ConfigurationError('The "defaultDestination" must be a valid Writable stream.');
    }
  }

  /**
   * Instantiates the necessary rule engines based on the provided rules.
   * @private
   * @param {Array<object>} rules - The array of rule configurations.
   * @returns {Map<string, import('./rules/base-rule-engine.js').BaseRuleEngine>} A map of instantiated rule engines.
   */
  #initializeEngines(rules) {
    const engines = new Map();
    for (const rule of rules) {
      if (!engines.has(rule.type)) {
        const EngineClass = ruleEngineMap.get(rule.type);
        if (!EngineClass) {
          // This case should theoretically be caught by the RuleValidator,
          // but this provides an extra layer of defense.
          throw new ConfigurationError(`Unsupported rule type: "${rule.type}".`);
        }
        engines.set(rule.type, new EngineClass());
      }
    }
    return engines;
  }

  /**
   * Sets up the initial structure for tracking metrics.
   * @private
   * @param {Array<object>} rules - The array of rule configurations.
   * @param {import('stream').Writable | null} defaultDestination - The default destination stream.
   * @returns {object} The initialized metrics object.
   */
  #initializeMetrics(rules, defaultDestination) {
    const metrics = {
      totalChunksProcessed: 0,
      totalChunksDropped: 0,
      rules: {},
    };

    for (const rule of rules) {
      metrics.rules[rule.name] = {
        matched: 0,
        routed: 0,
      };
    }

    if (defaultDestination) {
      metrics.default = {
        routed: 0,
      };
    }

    return metrics;
  }

  /**
   * The core transformation logic for the stream.
   * This method is called for each chunk of data from the source stream.
   *
   * @private
   * @param {any} chunk - The data chunk to process.
   * @param {BufferEncoding} encoding - The encoding of the chunk (if it's a string).
   * @param {import('stream').TransformCallback} callback - A function to call when processing is complete.
   */
  async _transform(chunk, encoding, callback) {
    this.#metrics.totalChunksProcessed++;
    let anyRuleMatched = false;
    const matchingDestinations = new Set();

    try {
      for (const rule of this.#rules) {
        const engine = this.#engines.get(rule.type);
        if (engine.evaluate(chunk, rule.expression)) {
          anyRuleMatched = true;
          this.#metrics.rules[rule.name].matched++;
          matchingDestinations.add(rule.destination);

          if (this.#stopOnFirstMatch) {
            break;
          }
        }
      }

      const destinationsToWrite = Array.from(matchingDestinations);

      if (!anyRuleMatched) {
        if (this.#defaultDestination) {
          destinationsToWrite.push(this.#defaultDestination);
        } else {
          this.#metrics.totalChunksDropped++;
        }
      }

      await this.#writeToDestinations(chunk, destinationsToWrite);

      // Update metrics after successful writes
      for (const rule of this.#rules) {
        if (matchingDestinations.has(rule.destination)) {
          this.#metrics.rules[rule.name].routed++;
        }
      }
      if (!anyRuleMatched && this.#defaultDestination) {
        this.#metrics.default.routed++;
      }

      if (this.#passThrough) {
        this.push(chunk);
      }

      callback();
    } catch (error) {
      // Wrap evaluation errors in a more specific error type
      if (!(error instanceof StreamProcessingError)) {
        callback(new StreamProcessingError('An unexpected error occurred during rule evaluation.', chunk, { cause: error }));
      } else {
        callback(error);
      }
    }
  }

  /**
   * Writes a chunk to multiple destination streams, handling backpressure.
   * @private
   * @param {any} chunk - The data chunk to write.
   * @param {Array<import('stream').Writable>} destinations - The destination streams.
   * @returns {Promise<void>} A promise that resolves when the chunk has been written to all destinations.
   */
  #writeToDestinations(chunk, destinations) {
    if (destinations.length === 0) {
      return Promise.resolve();
    }

    const writePromises = destinations.map(dest => {
      return new Promise((resolve, reject) => {
        // structuredClone is used to ensure that if one destination modifies
        // the object (in objectMode), it doesn't affect others.
        // For Buffers/strings, it's a cheap copy.
        const chunkCopy = this._writableState.objectMode ? structuredClone(chunk) : chunk;

        const canWriteImmediately = dest.write(chunkCopy, (err) => {
          if (err) {
            // Emit the error on the router stream to allow for central handling.
            this.emit('error', new StreamProcessingError(
              `Error writing to destination stream: ${err.message}`,
              chunkCopy,
              { cause: err }
            ));
            // We still resolve to not block other destinations, but the error is emitted.
            resolve();
          }
        });

        if (canWriteImmediately) {
          resolve();
        } else {
          // Handle backpressure: wait for the 'drain' event.
          dest.once('drain', resolve);
        }
      });
    });

    return Promise.all(writePromises);
  }

  /**
   * Finalizes the stream. This method is called when the source stream ends.
   * It ensures all destination streams are properly closed.
   *
   * @private
   * @param {import('stream').TransformCallback} callback - A function to call when flushing is complete.
   */
  _flush(callback) {
    const allDestinations = new Set(this.#rules.map(rule => rule.destination));
    if (this.#defaultDestination) {
      allDestinations.add(this.#defaultDestination);
    }

    // Call .end() on all unique destination streams that we managed.
    // This signals that no more data will be written to them.
    for (const dest of allDestinations) {
      // We only end streams that have an `end` method, which is standard for Writable streams.
      if (typeof dest.end === 'function') {
        dest.end();
      }
    }

    callback();
  }

  /**
   * Retrieves the current routing metrics.
   *
   * @returns {object} A snapshot of the current metrics, including total chunks processed,
   * dropped, and per-rule match/route counts. The returned object is a deep copy.
   */
  getMetrics() {
    return structuredClone(this.#metrics);
  }
}