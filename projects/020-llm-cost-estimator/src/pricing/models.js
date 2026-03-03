/**
 * @file src/pricing/models.js
 * @description Defines the structure and default pricing for supported LLM models.
 * This data acts as a fallback if fetching the latest pricing information fails.
 *
 * All prices are in USD per 1,000,000 tokens.
 * Using a "per million" unit helps avoid floating-point inaccuracies with very small numbers.
 * For example, GPT-4 Turbo input is $10 per 1M tokens.
 */

/**
 * @typedef {Object} ModelPricing
 * @property {number} input - The cost for 1,000,000 input tokens in USD.
 * @property {number} output - The cost for 1,000,000 output tokens in USD.
 * @property {string} unit - The unit for which the cost is specified (e.g., '1M tokens').
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} model - The unique model identifier.
 * @property {string} provider - The name of the provider (e.g., 'openai', 'anthropic').
 * @property {ModelPricing} pricing - The pricing details for the model.
 * @property {number} [contextWindow] - The maximum context window size for the model.
 */

/**
 * @typedef {Object.<string, ModelInfo>} ProviderModels
 */

/**
 * @typedef {Object.<string, ProviderModels>} ModelData
 */

/**
 * Default pricing data for various LLM providers and their models.
 * This serves as a static fallback.
 *
 * Prices are based on public data as of late 2024.
 *
 * @type {ModelData}
 */
const defaultModels = {
  openai: {
    'gpt-4-turbo': {
      model: 'gpt-4-turbo',
      provider: 'openai',
      pricing: {
        input: 10.00, // $10.00 / 1M tokens
        output: 30.00, // $30.00 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 128000,
    },
    'gpt-4o': {
      model: 'gpt-4o',
      provider: 'openai',
      pricing: {
        input: 5.00, // $5.00 / 1M tokens
        output: 15.00, // $15.00 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 128000,
    },
    'gpt-3.5-turbo-0125': {
      model: 'gpt-3.5-turbo-0125',
      provider: 'openai',
      pricing: {
        input: 0.50, // $0.50 / 1M tokens
        output: 1.50, // $1.50 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 16385,
    },
  },
  anthropic: {
    'claude-3-opus-20240229': {
      model: 'claude-3-opus-20240229',
      provider: 'anthropic',
      pricing: {
        input: 15.00, // $15.00 / 1M tokens
        output: 75.00, // $75.00 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 200000,
    },
    'claude-3-sonnet-20240229': {
      model: 'claude-3-sonnet-20240229',
      provider: 'anthropic',
      pricing: {
        input: 3.00, // $3.00 / 1M tokens
        output: 15.00, // $15.00 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 200000,
    },
    'claude-3-haiku-20240307': {
      model: 'claude-3-haiku-20240307',
      provider: 'anthropic',
      pricing: {
        input: 0.25, // $0.25 / 1M tokens
        output: 1.25, // $1.25 / 1M tokens
        unit: '1M tokens',
      },
      contextWindow: 200000,
    },
  },
};

/**
 * A deep-cloned, read-only proxy to the default models object.
 * This prevents accidental modification of the original fallback data.
 * The `structuredClone` ensures that consumers get a mutable copy if they need one,
 * without affecting the global default.
 *
 * @returns {ModelData} A deep copy of the default models data.
 */
export function getDefaultModels() {
  return structuredClone(defaultModels);
}

/**
 * Retrieves the pricing information for a specific model.
 *
 * @param {string} provider - The provider name (e.g., 'openai').
 * @param {string} model - The model identifier (e.g., 'gpt-4-turbo').
 * @returns {ModelInfo | undefined} The model information object, or undefined if not found.
 */
export function getModel(provider, model) {
  return defaultModels[provider]?.[model];
}

/**
 * Retrieves a list of all supported models.
 *
 * @returns {Array<ModelInfo>} An array of all model information objects.
 */
export function listAllModels() {
  return Object.values(defaultModels).flatMap(providerModels => Object.values(providerModels));
}

/**
 * Retrieves a list of all supported provider names.
 *
 * @returns {Array<string>} An array of provider names.
 */
export function listAllProviders() {
  return Object.keys(defaultModels);
}