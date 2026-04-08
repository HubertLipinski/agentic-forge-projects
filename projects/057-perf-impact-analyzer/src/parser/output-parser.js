/**
 * @fileoverview Parses raw benchmark output using user-configured regular expressions
 * to extract named performance metrics. This module is crucial for translating unstructured
 * log output into structured, analyzable data.
 */

import stripAnsi from 'strip-ansi';
import logger from '../utils/logger.js';

/**
 * Parses a single block of benchmark output text to extract numerical values for all configured metrics.
 * It iterates through each metric defined in the configuration, applies its regex to the output,
 * and collects the results.
 *
 * @param {string} output - The raw stdout from a benchmark script execution.
 * @param {Array<object>} metricsConfig - An array of metric configuration objects, each containing a `name` and a `regex`.
 *   Example: `[{ name: 'ops/sec', regex: 'ops/sec: (\\d+\\.?\\d*)' }]`
 * @returns {Record<string, number>} An object mapping metric names to their parsed numerical values.
 *   If a metric's regex does not find a match, the metric name will not be included in the result.
 * @throws {Error} If inputs are invalid or if a regex fails to capture a numerical value correctly.
 */
export function parseBenchmarkOutput(output, metricsConfig) {
  if (typeof output !== 'string') {
    throw new Error('Invalid input: `output` must be a string.');
  }
  if (!Array.isArray(metricsConfig)) {
    throw new Error('Invalid input: `metricsConfig` must be an array.');
  }

  // Clean the output by removing ANSI color codes, which can interfere with regex matching.
  const cleanOutput = stripAnsi(output);
  const results = {};

  logger.debug('Starting benchmark output parsing...');
  logger.debug(`Raw output length: ${output.length}, Cleaned output length: ${cleanOutput.length}`);

  for (const metric of metricsConfig) {
    if (!metric || typeof metric.name !== 'string' || typeof metric.regex !== 'string') {
      logger.warn('Skipping invalid metric configuration entry.');
      continue;
    }

    logger.debug(`Attempting to match metric "${metric.name}" with regex: /${metric.regex}/`);

    try {
      // The 'g' flag is not used here because we typically expect one definitive value per metric per run.
      // The 'm' flag can be useful if the benchmark output is multi-line and regexes use ^ or $.
      // We assume the user provides a regex with a single capturing group for the numerical value.
      const regex = new RegExp(metric.regex);
      const match = cleanOutput.match(regex);

      if (match) {
        // The first capturing group (index 1) should contain the numerical value.
        // Index 0 is the full string matched by the regex.
        if (match[1]) {
          const rawValue = match[1];
          const parsedValue = parseFloat(rawValue);

          if (!Number.isNaN(parsedValue)) {
            results[metric.name] = parsedValue;
            logger.debug(`Successfully parsed metric "${metric.name}": ${parsedValue}`);
          } else {
            // This case is important: the regex matched, but the captured group was not a number.
            logger.warn(
              `Metric "${metric.name}" matched, but the captured value "${rawValue}" could not be parsed as a number. It will be ignored.`
            );
          }
        } else {
          // This indicates a misconfigured regex that matches but has no capturing group.
          logger.warn(
            `Metric "${metric.name}" matched, but the regex /${metric.regex}/ has no capturing group. The value cannot be extracted.`
          );
        }
      } else {
        // This is a common and expected case if a particular run doesn't output a specific metric.
        logger.debug(`Metric "${metric.name}" not found in the output.`);
      }
    } catch (error) {
      // This catches errors from `new RegExp()`, though `config-loader` should pre-validate.
      // It's included here for defense-in-depth.
      throw new Error(`Error processing regex for metric "${metric.name}": ${error.message}`);
    }
  }

  // After parsing, verify that we found at least one metric. If not, the benchmark might have failed silently
  // or the regexes might be completely wrong. This is a critical warning for the user.
  if (Object.keys(results).length === 0) {
    logger.warn(
      'Parsing complete, but no metrics were extracted from the benchmark output. Please check your `metrics` configuration (regex) and ensure your benchmark script produces the expected output.'
    );
  }

  return results;
}