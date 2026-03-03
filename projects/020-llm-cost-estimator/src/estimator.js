/**
 * @file src/estimator.js
 * @description Core logic for calculating cost based on model, token counts, and pricing data.
 * Exports the main `estimateCost` function.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { fetchAllPricingData } from './pricing/fetcher.js';
import { countTokens as countTokensInText } from './tokenizers/simple-tokenizer.js';
import { getDefaultModels } from './pricing/models.js';

/**
 * @typedef {import('./pricing/models.js').ModelData} ModelData
 * @typedef {import('./pricing/models.js').ModelInfo} ModelInfo
 */

/**
 * @typedef {object} TokenCounts
 * @property {number} [inputTokens=0] - The number of input (prompt) tokens.
 * @property {number} [outputTokens=0] - The number of output (completion) tokens.
 * @property {string} [inputText] - The input text, used to estimate input tokens if `inputTokens` is not provided.
 * @property {string} [outputText] - The output text, used to estimate output tokens if `outputTokens` is not provided.
 */

/**
 * @typedef {object} CostEstimate
 * @property {number} totalCost - The total estimated cost in USD.
 * @property {number} inputCost - The cost attributed to input tokens in USD.
 * @property {number} outputCost - The cost attributed to output tokens in USD.
 * @property {number} inputTokens - The number of input tokens used in the calculation.
 * @property {number} outputTokens - The number of output tokens used in the calculation.
 * @property {string} model - The model identifier for which the cost was estimated.
 * @property {string} provider - The provider of the model.
 * @property {object} pricing - The pricing details used for the calculation.
 * @property {number} pricing.input - The cost per 1,000,000 input tokens in USD.
 * @property {number} pricing.output - The cost per 1,000,000 output tokens in USD.
 */

/**
 * A singleton promise that resolves to the global pricing data.
 * This ensures that `fetchAllPricingData` is called only once per application lifecycle,
 * unless forced. The promise is then reused for all subsequent calls to `estimateCost`.
 * @type {Promise<ModelData> | null}
 */
let pricingDataPromise = null;

/**
 * Initializes and returns the singleton promise for fetching pricing data.
 *
 * @param {object} [options={}] - Configuration options for fetching.
 * @param {boolean} [options.force=false] - If true, forces a refetch, bypassing the cache.
 * @returns {Promise<ModelData>} A promise that resolves to the pricing data.
 */
function getPricingData({ force = false } = {}) {
  if (pricingDataPromise === null || force) {
    pricingDataPromise = fetchAllPricingData({ force });
  }
  return pricingDataPromise;
}

/**
 * Finds a model's information from the comprehensive pricing data.
 * It performs a case-insensitive search and can find a model by its alias (e.g., 'gpt-4' for 'gpt-4-turbo').
 *
 * @param {ModelData} allModelsData - The complete data of all models from all providers.
 * @param {string} provider - The provider name (e.g., 'openai').
 * @param {string} model - The model identifier to find.
 * @returns {ModelInfo | undefined} The found model information or undefined.
 */
function findModel(allModelsData, provider, model) {
  const lowerCaseProvider = provider.toLowerCase();
  const lowerCaseModel = model.toLowerCase();

  const providerModels = allModelsData[lowerCaseProvider];
  if (!providerModels) {
    return undefined;
  }

  // Direct match (case-insensitive)
  const directMatch = Object.values(providerModels).find(
    m => m.model.toLowerCase() === lowerCaseModel
  );
  if (directMatch) {
    return directMatch;
  }

  // Alias handling (e.g., 'gpt-4-turbo' can be found by 'gpt-4')
  // This is a simple prefix match, which works for many common aliases.
  const aliasMatch = Object.values(providerModels).find(
    m => m.model.toLowerCase().startsWith(lowerCaseModel)
  );

  return aliasMatch;
}

/**
 * Calculates the cost for a given number of tokens and a price per million tokens.
 *
 * @param {number} tokens - The number of tokens.
 * @param {number} pricePerMillion - The cost in USD for 1,000,000 tokens.
 * @returns {number} The calculated cost in USD.
 */
function calculateCostForTokens(tokens, pricePerMillion) {
  if (tokens === 0 || pricePerMillion === 0) {
    return 0;
  }
  // To avoid floating point issues, we perform division last.
  return (tokens * pricePerMillion) / 1_000_000;
}

/**
 * Estimates the cost of an LLM API call based on the model and token counts.
 *
 * This is the main function of the library. It fetches the latest pricing data (or uses a cache),
 * determines the token counts from either direct numbers or input text, and calculates the cost.
 *
 * @param {string} provider - The provider of the model (e.g., 'openai', 'anthropic').
 * @param {string} model - The model identifier (e.g., 'gpt-4-turbo', 'claude-3-opus-20240229').
 * @param {TokenCounts} tokens - An object containing token counts or text to be tokenized.
 * @param {object} [options={}] - Optional configuration.
 * @param {boolean} [options.force=false] - If true, forces a refetch of pricing data, bypassing the cache.
 * @returns {Promise<CostEstimate>} A promise that resolves to an object with the detailed cost breakdown.
 *
 * @example
 * // Basic usage with token counts
 * const cost = await estimateCost('openai', 'gpt-4o', { inputTokens: 10000, outputTokens: 5000 });
 * console.log(`Total cost: $${cost.totalCost.toFixed(6)}`);
 *
 * @example
 * // Usage with raw text (token count is estimated)
 * const costFromText = await estimateCost('anthropic', 'claude-3-haiku-20240307', {
 *   inputText: 'This is a prompt for the model.',
 *   outputText: 'This is the model's response.'
 * });
 * console.log(`Input tokens: ${costFromText.inputTokens}, Output tokens: ${costFromText.outputTokens}`);
 */
export async function estimateCost(provider, model, tokens, options = {}) {
  if (!provider || !model || !tokens) {
    throw new Error('`provider`, `model`, and `tokens` arguments are required.');
  }

  if (typeof provider !== 'string' || typeof model !== 'string') {
    throw new Error('`provider` and `model` must be strings.');
  }

  if (typeof tokens !== 'object' || tokens === null) {
    throw new Error('`tokens` must be an object.');
  }

  try {
    const allModelsData = await getPricingData(options);
    const modelInfo = findModel(allModelsData, provider, model);

    if (!modelInfo) {
      throw new Error(`Model not found for provider '${provider}' and model name '${model}'. Check supported models.`);
    }

    const { pricing } = modelInfo;

    const inputTokens = tokens.inputTokens ?? countTokensInText(tokens.inputText);
    const outputTokens = tokens.outputTokens ?? countTokensInText(tokens.outputText);

    const inputCost = calculateCostForTokens(inputTokens, pricing.input);
    const outputCost = calculateCostForTokens(outputTokens, pricing.output);
    const totalCost = inputCost + outputCost;

    return {
      totalCost,
      inputCost,
      outputCost,
      inputTokens,
      outputTokens,
      model: modelInfo.model,
      provider: modelInfo.provider,
      pricing: {
        input: pricing.input,
        output: pricing.output,
      },
    };
  } catch (error) {
    console.error(`[llm-cost-estimator] Failed to estimate cost: ${error.message}`);
    // Re-throw the error so the calling code can handle it.
    // This maintains the original error type and stack trace.
    throw error;
  }
}

/**
 * Resets the internal pricing data cache, forcing a fresh fetch on the next `estimateCost` call.
 * This is useful for long-running applications that need to ensure they have the most up-to-date pricing,
 * or for testing purposes.
 */
export function resetPricingData() {
  pricingDataPromise = null;
}