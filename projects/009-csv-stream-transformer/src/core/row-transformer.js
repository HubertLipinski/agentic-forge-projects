/**
 * @file src/core/row-transformer.js
 * @description A Transform stream that applies filtering, mapping, and value transformations
 * to each CSV row object based on the provided configuration.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { Transform } from 'node:stream';
import builtInValueTransformers from '../transformers/value-transformers.js';

/**
 * A custom error class for issues occurring within the RowTransformer.
 * This helps in pinpointing errors related to data transformation logic.
 */
class RowTransformerError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this one.
   * @param {object} [options.details] - Additional context, like the row being processed.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'RowTransformerError';
    if (options.details) {
      this.details = options.details;
    }
  }
}

/**
 * A Node.js Transform stream that processes individual CSV row objects.
 * For each row, it performs the following actions in order:
 * 1. **Filtering**: It checks if the row meets all specified filter criteria. If not, the row is discarded.
 * 2. **Mapping and Transformation**: If the row passes the filters, it creates a new object based on the
 *    mapping rules. This includes renaming columns and applying a series of value transformations.
 *
 * This stream expects chunks to be JavaScript objects (as produced by `csv-parse` with `columns: true`)
 * and pushes transformed JavaScript objects downstream.
 */
export class RowTransformer extends Transform {
  /**
   * @param {object} options - Configuration for the transformer.
   * @param {Array<object>} [options.filterRules=[]] - An array of filter rules to apply.
   * @param {Array<object>} options.mappingRules - An array of mapping and transformation rules.
   * @param {object} [options.customTransformers={}] - A map of user-provided value transformer functions.
   */
  constructor({ filterRules = [], mappingRules, customTransformers = {} } = {}) {
    // Ensure the stream operates in object mode
    super({ objectMode: true });

    if (!mappingRules || !Array.isArray(mappingRules)) {
      throw new RowTransformerError('`mappingRules` must be a non-empty array.');
    }

    this.filterRules = filterRules;
    this.mappingRules = mappingRules;
    this.allTransformers = { ...builtInValueTransformers, ...customTransformers };
    this.rowCount = 0;
  }

  /**
   * The main transformation logic, called for each chunk (row object) in the stream.
   * @param {object} row - The input row object from the CSV parser.
   * @param {string} encoding - The encoding of the chunk (ignored in objectMode).
   * @param {import('stream').TransformCallback} callback - A function to call when processing is complete.
   * @private
   */
  _transform(row, encoding, callback) {
    this.rowCount++;
    try {
      if (this.shouldKeepRow(row)) {
        const transformedRow = this.applyMapping(row);
        this.push(transformedRow);
      }
      callback();
    } catch (error) {
      // Enrich the error with context and pass it to the stream's error handling mechanism.
      const contextualError = new RowTransformerError(
        `Error processing row number ${this.rowCount}: ${error.message}`,
        { cause: error, details: { row } }
      );
      callback(contextualError);
    }
  }

  /**
   * Determines if a row should be kept based on the configured filter rules.
   * A row is kept only if it satisfies ALL filter rules (AND logic).
   * An empty filter set means all rows are kept.
   *
   * @param {object} row - The row object to evaluate.
   * @returns {boolean} `true` if the row should be kept, `false` otherwise.
   */
  shouldKeepRow(row) {
    if (this.filterRules.length === 0) {
      return true;
    }

    // `every` ensures all conditions must be met.
    return this.filterRules.every(rule => {
      const value = row[rule.column];

      if (rule.hasOwnProperty('equals')) {
        return value === rule.equals;
      }
      if (rule.hasOwnProperty('not')) {
        return value !== rule.not;
      }
      // If a rule has neither 'equals' nor 'not', it's a schema violation, but we treat it as passing.
      // The config-loader should prevent this state.
      return true;
    });
  }

  /**
   * Applies mapping and value transformations to a single row.
   * It constructs a new object based on the `mappingRules`.
   *
   * @param {object} row - The original row object.
   * @returns {object} The newly created, transformed row object.
   * @throws {RowTransformerError} If a specified transformer function is not found.
   */
  applyMapping(row) {
    const newRow = {};

    for (const rule of this.mappingRules) {
      const sourceColumn = rule.from;
      const targetColumn = rule.to ?? sourceColumn;
      let value = row[sourceColumn];

      if (rule.transform && Array.isArray(rule.transform)) {
        for (const transform of rule.transform) {
          const transformerFn = this.allTransformers[transform.name];

          if (typeof transformerFn !== 'function') {
            throw new RowTransformerError(`Transformer function "${transform.name}" not found.`);
          }

          const params = transform.params ?? [];
          value = transformerFn(value, ...params);
        }
      }

      newRow[targetColumn] = value;
    }

    return newRow;
  }

  /**
   * Called when there is no more data to be consumed.
   * @param {import('stream').TransformCallback} callback - A function to call when flushing is complete.
   * @private
   */
  _flush(callback) {
    // No final processing needed for this transformer.
    callback();
  }
}