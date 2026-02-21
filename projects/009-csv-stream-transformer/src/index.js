/**
 * @file src/index.js
 * @description Main library entry point for the CSV Stream Transformer.
 * This module exports the primary function `transformCsv` which allows programmatic
 * use of the transformation pipeline. It orchestrates the creation of streams,
 * loading of configuration, and execution of the pipeline.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable }from 'node:stream';
import { loadAndValidateConfig } from './utils/config-loader.js';
import { buildAndRunPipeline } from './core/pipeline-builder.js';

/**
 * A custom error class for the main public API.
 * This helps users of the library distinguish errors originating from
 * this library from other application errors.
 */
class CsvTransformError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this one.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CsvTransformError';
  }
}

/**
 * Transforms a CSV data source based on a provided configuration.
 *
 * This is the main programmatic entry point for the library. It handles I/O
 * setup (from file paths or streams), configuration loading, and pipeline execution.
 * It provides a high-level, easy-to-use interface for CSV transformation tasks.
 *
 * @async
 * @function transformCsv
 * @param {object} options - The options for the transformation.
 * @param {string|import('stream').Readable} options.source - The source of the CSV data. Can be a file path (string) or a Readable stream.
 * @param {string|import('stream').Writable} options.destination - The destination for the transformed CSV data. Can be a file path (string) or a Writable stream.
 * @param {string|object} options.config - The transformation configuration. Can be a file path to a JSON config file (string) or a validated configuration object.
 * @param {object} [options.customTransformers={}] - An object containing user-defined value transformer functions. These will be merged with the built-in transformers.
 * @returns {Promise<void>} A promise that resolves when the transformation is complete, or rejects if an error occurs.
 * @throws {CsvTransformError} If inputs are invalid or an error occurs during processing.
 *
 * @example
 * // Example using file paths
 * await transformCsv({
 *   source: 'path/to/input.csv',
 *   destination: 'path/to/output.csv',
 *   config: 'path/to/config.json'
 * });
 *
 * @example
 * // Example using streams and a config object
 * import { Readable } from 'stream';
 * const sourceStream = Readable.from(['header1,header2\nval1,val2']);
 * const destinationStream = process.stdout;
 * const configObject = { mapping: [{ from: 'header1', to: 'new_header' }] };
 * await transformCsv({
 *   source: sourceStream,
 *   destination: destinationStream,
 *   config: configObject
 * });
 */
export async function transformCsv({
  source,
  destination,
  config,
  customTransformers = {},
}) {
  if (!source) {
    throw new CsvTransformError('The `source` option (file path or Readable stream) is required.');
  }
  if (!destination) {
    throw new CsvTransformError('The `destination` option (file path or Writable stream) is required.');
  }
  if (!config) {
    throw new CsvTransformError('The `config` option (file path or configuration object) is required.');
  }

  let sourceStream;
  let destinationStream;
  let finalConfig;

  try {
    // --- 1. Resolve Configuration ---
    // If `config` is a string, load and validate it from the file path.
    // If it's an object, we assume it's a valid configuration (for advanced use).
    // The pipeline builder will still rely on its structure being correct.
    if (typeof config === 'string') {
      finalConfig = await loadAndValidateConfig(config);
    } else if (typeof config === 'object' && config !== null) {
      // For programmatic use, we trust the user to provide a valid object.
      // A deeper validation could be added here if desired, but for now we keep it simple.
      if (!config.mapping) {
        throw new CsvTransformError('The provided config object must have a `mapping` property.');
      }
      finalConfig = config;
    } else {
      throw new CsvTransformError('The `config` option must be a file path (string) or a configuration object.');
    }

    // --- 2. Set up I/O Streams ---
    // Create readable stream from file path or use existing stream.
    if (typeof source === 'string') {
      sourceStream = createReadStream(source);
    } else if (source instanceof Readable) {
      sourceStream = source;
    } else {
      throw new CsvTransformError('The `source` option must be a file path (string) or a Readable stream.');
    }

    // Create writable stream from file path or use existing stream.
    if (typeof destination === 'string') {
      destinationStream = createWriteStream(destination);
    } else if (destination instanceof Writable) {
      destinationStream = destination;
    } else {
      throw new CsvTransformError('The `destination` option must be a file path (string) or a Writable stream.');
    }

    // --- 3. Build and Run the Pipeline ---
    // Delegate the core stream orchestration to the pipeline builder.
    await buildAndRunPipeline({
      sourceStream,
      destinationStream,
      config: finalConfig,
      customTransformers,
    });

  } catch (error) {
    // Wrap any underlying error (from config loading, stream creation, or pipeline execution)
    // in our public-facing error type for consistent error handling by the consumer.
    throw new CsvTransformError(`CSV transformation failed: ${error.message}`, { cause: error });
  }
}