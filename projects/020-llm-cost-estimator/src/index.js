/**
 * @file src/index.js
 * @description Main entry point for the llm-cost-estimator library.
 * This file consolidates and exports the public API, making it easy for other
 * projects to consume the cost estimation functionality programmatically.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

// Core estimation functionality
import {
  estimateCost,
  resetPricingData
} from './estimator.js';

// Utility for token counting
import {
  countTokens
} from './tokenizers/simple-tokenizer.js';

// Utilities for inspecting supported models and providers
import {
  listAllModels,
  listAllProviders,
  getModel,
  getDefaultModels
} from './pricing/models.js';

// Re-exporting the main functions and utilities to create the public API.
// This allows users to import everything they need from the root package.
// e.g., `import { estimateCost, countTokens } from 'llm-cost-estimator';`

export {
  /**
   * Estimates the cost of an LLM API call based on the model and token counts.
   * This is the primary function of the library.
   * @function estimateCost
   * @param {string} provider - The provider of the model (e.g., 'openai').
   * @param {string} model - The model identifier (e.g., 'gpt-4-turbo').
   * @param {object} tokens - An object with token counts or text.
   * @param {object} [options] - Optional configuration.
   * @returns {Promise<object>} A promise resolving to the cost breakdown.
   */
  estimateCost,

  /**
   * Resets the internal pricing data cache, forcing a fresh fetch on the next call.
   * @function resetPricingData
   */
  resetPricingData,

  /**
   * Estimates the number of tokens in a given string of text using a lightweight,
   * dependency-free tokenizer.
   * @function countTokens
   * @param {string | null | undefined} text - The input text to tokenize.
   * @returns {number} The estimated number of tokens.
   */
  countTokens,

  /**
   * Retrieves a list of all supported model information objects.
   * @function listAllModels
   * @returns {Array<object>} An array of all model info objects.
   */
  listAllModels,

  /**
   * Retrieves a list of all supported provider names.
   * @function listAllProviders
   * @returns {Array<string>} An array of provider names.
   */
  listAllProviders,

  /**
   * Retrieves the default pricing and information for a specific model.
   * @function getModel
   * @param {string} provider - The provider name.
   * @param {string} model - The model identifier.
   * @returns {object | undefined} The model information object, or undefined if not found.
   */
  getModel,

  /**
   * Returns a deep copy of the entire default models and pricing data structure.
   * Useful for inspecting all fallback data.
   * @function getDefaultModels
   * @returns {object} A deep copy of the default models data.
   */
  getDefaultModels
};

// Default export for convenience, providing the primary function.
// This allows for `import estimate from 'llm-cost-estimator';`
export default estimateCost;