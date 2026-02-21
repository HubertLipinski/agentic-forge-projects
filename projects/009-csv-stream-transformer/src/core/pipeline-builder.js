/**
 * @file src/core/pipeline-builder.js
 * @description Core module that constructs a Node.js stream pipeline.
 * This module is responsible for assembling the various stream components
 * (parser, transformer, stringifier) based on a validated configuration object.
 * It provides a high-level function to orchestrate the end-to-end transformation process.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { pipeline } from 'node:stream/promises';
import { parse as csvParse } from 'csv-parse';
import { stringify as csvStringify } from 'csv-stringify';
import { RowTransformer } from './row-transformer.js';

/**
 * A custom error class for pipeline-related issues.
 * This helps in distinguishing stream processing errors from other types of errors.
 */
class PipelineError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this one.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'PipelineError';
  }
}

/**
 * Constructs and executes a stream-based CSV transformation pipeline.
 *
 * This function orchestrates the entire ETL process by:
 * 1. Creating a CSV parser stream (`csv-parse`) with specified options.
 * 2. Creating a `RowTransformer` stream to apply filtering, mapping, and value transformations.
 * 3. Creating a CSV stringifier stream (`csv-stringify`) to format the output.
 * 4. Connecting these streams between a readable source and a writable destination using `stream.pipeline`.
 *
 * The use of `stream.pipeline` ensures that all streams are properly destroyed and errors are
 * correctly propagated if any part of the pipeline fails.
 *
 * @async
 * @function buildAndRunPipeline
 * @param {object} options - The options for building the pipeline.
 * @param {import('stream').Readable} options.sourceStream - The readable stream providing the source CSV data (e.g., from a file).
 * @param {import('stream').Writable} options.destinationStream - The writable stream to which the transformed CSV data will be written.
 * @param {object} options.config - The validated transformation configuration object.
 * @param {object} [options.customTransformers={}] - An object containing user-defined value transformer functions.
 * @returns {Promise<void>} A promise that resolves when the pipeline has completed successfully, or rejects if an error occurs.
 * @throws {PipelineError} If an error occurs during the stream processing.
 */
export async function buildAndRunPipeline({
  sourceStream,
  destinationStream,
  config,
  customTransformers = {},
}) {
  if (!sourceStream || typeof sourceStream.pipe !== 'function') {
    throw new PipelineError('A valid readable source stream must be provided.');
  }
  if (!destinationStream || typeof destinationStream.write !== 'function') {
    throw new PipelineError('A valid writable destination stream must be provided.');
  }
  if (!config || typeof config !== 'object') {
    throw new PipelineError('A valid configuration object must be provided.');
  }

  // --- 1. Configure the CSV Parser Stream ---
  // Default options ensure we get objects with headers as keys.
  // User-provided options will override these defaults.
  const parseOptions = {
    columns: true, // Treat the first line as headers
    skip_empty_lines: true,
    ...config.csvParseOptions,
  };
  const parser = csvParse(parseOptions);

  // --- 2. Configure the Row Transformer Stream ---
  // This custom Transform stream applies the logic defined in the config.
  const rowTransformer = new RowTransformer({
    filterRules: config.filter,
    mappingRules: config.mapping,
    customTransformers,
  });

  // --- 3. Configure the CSV Stringifier Stream ---
  // The stringifier needs to know the final column headers.
  // We derive this from the `mapping` configuration.
  const outputHeaders = config.mapping.map(mapRule => mapRule.to ?? mapRule.from);

  // Default options ensure the header is written.
  // User-provided options will override these defaults.
  const stringifyOptions = {
    header: true,
    columns: outputHeaders,
    ...config.csvStringifyOptions,
  };
  const stringifier = csvStringify(stringifyOptions);

  // --- 4. Assemble and run the pipeline ---
  // `pipeline` connects the streams and handles error propagation and cleanup.
  try {
    await pipeline(
      sourceStream,
      parser,
      rowTransformer,
      stringifier,
      destinationStream
    );
  } catch (error) {
    // Wrap the stream error in our custom error type for better context.
    throw new PipelineError('An error occurred during the CSV transformation pipeline.', { cause: error });
  }
}