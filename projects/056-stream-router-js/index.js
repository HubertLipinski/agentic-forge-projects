/**
 * @file index.js
 * @description The main entry point for the Stream Router JS library.
 * This file serves as the public API surface, exporting the primary `createStreamRouter`
 * factory function, the `StreamRouter` class itself, and the custom error classes.
 * Consumers of the library will import these components to build their streaming data pipelines.
 */

import { StreamRouter } from './lib/stream-router.js';
import {
  StreamRouterError,
  RuleValidationError,
  StreamProcessingError,
  ConfigurationError
} from './lib/utils/errors.js';
import { BaseRuleEngine } from './lib/rules/base-rule-engine.js';
import { JSONPathRuleEngine } from './lib/rules/jsonpath-rule-engine.js';
import { RegexRuleEngine } from './lib/rules/regex-rule-engine.js';

/**
 * A factory function that creates and returns a new `StreamRouter` instance.
 * This is the recommended way to instantiate the router, providing a clean and simple interface.
 *
 * @function createStreamRouter
 * @param {object} options - Configuration options for the router.
 * @param {Array<object>} options.rules - An array of rule objects to configure the routing logic.
 *   Each rule object defines a condition and a destination stream.
 * @param {boolean} [options.objectMode=false] - If true, the stream will operate in object mode,
 *   expecting JavaScript objects as chunks. Defaults to `false` for Buffer/string streams.
 * @param {boolean} [options.stopOnFirstMatch=false] - If true, routing for a chunk stops after
 *   the first matching rule is found. If false, a chunk can be sent to multiple destinations.
 *   Defaults to `false`.
 * @param {import('stream').Writable} [options.defaultDestination=null] - A default writable stream
 *   for chunks that do not match any of the defined rules. If not provided, unmatched chunks are dropped.
 * @param {boolean} [options.passThrough=false] - If true, all chunks that are processed by the router
 *   are also pushed to its readable side, allowing it to be placed in the middle of a `pipeline`
 *   while also fanning out to other destinations. Defaults to `false`.
 * @returns {StreamRouter} A new instance of the `StreamRouter` transform stream.
 * @throws {ConfigurationError} If the provided options are invalid (e.g., missing or malformed rules).
 * @throws {RuleValidationError} If a specific rule's structure is invalid.
 *
 * @example
 * import { createStreamRouter } from 'stream-router-js';
 * import { Writable } from 'node:stream';
 *
 * const errorLog = new Writable({ write: (chunk, _, cb) => { console.error(chunk.toString()); cb(); } });
 * const infoLog = new Writable({ write: (chunk, _, cb) => { console.log(chunk.toString()); cb(); } });
 *
 * const router = createStreamRouter({
 *   rules: [
 *     { name: 'errors', type: 'regex', expression: 'ERROR', destination: errorLog },
 *     { name: 'info', type: 'regex', expression: 'INFO', destination: infoLog }
 *   ]
 * });
 *
 * sourceStream.pipe(router);
 */
function createStreamRouter(options) {
  return new StreamRouter(options);
}

// Export the factory function as the default export for convenience.
export default createStreamRouter;

// Export all public-facing classes and functions for consumers who need more control or type information.
export {
  // Core class
  StreamRouter,

  // Factory function (also default export)
  createStreamRouter,

  // Rule Engines (for extension or direct use)
  BaseRuleEngine,
  JSONPathRuleEngine,
  RegexRuleEngine,

  // Custom Error classes for robust error handling
  StreamRouterError,
  RuleValidationError,
  StreamProcessingError,
  ConfigurationError
};