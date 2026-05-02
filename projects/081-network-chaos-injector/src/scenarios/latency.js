/**
 * @file src/scenarios/latency.js
 * @description Chaos scenario implementation for injecting a delay before a request proceeds.
 * This scenario pauses the execution for a specified duration, simulating network latency.
 * The delay can be a fixed number of milliseconds or a random value within a specified range.
 */

import { ConfigValidationError } from '../utils/config-validator.js';

/**
 * Validates the options for the latency scenario.
 *
 * @param {object} options - The scenario-specific configuration.
 * @param {number} [options.delay] - A fixed delay in milliseconds.
 * @param {number} [options.minDelay] - The minimum delay for a random range.
 * @param {number} [options.maxDelay] - The maximum delay for a random range.
 * @throws {ConfigValidationError} if the options are invalid.
 */
function validateLatencyOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new ConfigValidationError('Latency scenario requires an options object.', 'scenario.options');
  }

  const { delay, minDelay, maxDelay } = options;
  const hasFixedDelay = delay !== undefined;
  const hasRangeDelay = minDelay !== undefined || maxDelay !== undefined;

  if (hasFixedDelay && hasRangeDelay) {
    throw new ConfigValidationError(
      "Latency options cannot specify both 'delay' and 'minDelay'/'maxDelay'.",
      'scenario.options'
    );
  }

  if (!hasFixedDelay && !hasRangeDelay) {
    throw new ConfigValidationError(
      "Latency options must specify either 'delay' or both 'minDelay' and 'maxDelay'.",
      'scenario.options'
    );
  }

  if (hasFixedDelay) {
    if (typeof delay !== 'number' || !Number.isInteger(delay) || delay < 0) {
      throw new ConfigValidationError("Option 'delay' must be a non-negative integer.", 'scenario.options.delay');
    }
  }

  if (hasRangeDelay) {
    if (minDelay === undefined || maxDelay === undefined) {
      throw new ConfigValidationError(
        "Both 'minDelay' and 'maxDelay' must be provided for a random delay range.",
        'scenario.options'
      );
    }
    if (typeof minDelay !== 'number' || !Number.isInteger(minDelay) || minDelay < 0) {
      throw new ConfigValidationError("Option 'minDelay' must be a non-negative integer.", 'scenario.options.minDelay');
    }
    if (typeof maxDelay !== 'number' || !Number.isInteger(maxDelay) || maxDelay < 0) {
      throw new ConfigValidationError("Option 'maxDelay' must be a non-negative integer.", 'scenario.options.maxDelay');
    }
    if (minDelay > maxDelay) {
      throw new ConfigValidationError(
        "'minDelay' cannot be greater than 'maxDelay'.",
        'scenario.options'
      );
    }
  }
}

/**
 * Calculates the delay duration based on the provided options.
 *
 * @param {object} options - The validated latency scenario options.
 * @returns {number} The calculated delay in milliseconds.
 */
function calculateDelay(options) {
  if (options.delay !== undefined) {
    return options.delay;
  }

  const { minDelay, maxDelay } = options;
  // Formula for a random integer between min and max (inclusive)
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

/**
 * Creates a promise that resolves after a specified duration.
 *
 * @param {number} duration - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the timer completes.
 */
function wait(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Applies the latency chaos scenario.
 * It introduces a delay before allowing the original request function to be called.
 *
 * @param {Function} originalRequestFn - The original `http.request` or `https.request` function.
 * @param {Array<any>} originalRequestArgs - The arguments passed to the original request function.
 * @param {object} scenarioOptions - The scenario-specific configuration from the matched rule.
 * @returns {Promise<import('http').ClientRequest>} A promise that resolves with the ClientRequest after the delay.
 */
export async function apply(originalRequestFn, originalRequestArgs, scenarioOptions) {
  validateLatencyOptions(scenarioOptions);

  const delayMs = calculateDelay(scenarioOptions);

  if (delayMs > 0) {
    await wait(delayMs);
  }

  // After the delay, proceed with the original request.
  // The return value of originalRequestFn is the ClientRequest, which we must return.
  return originalRequestFn(...originalRequestArgs);
}