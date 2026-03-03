/**
 * @file src/pricing/fetcher.js
 * @description Module responsible for fetching the latest pricing information from public sources.
 * Includes simple in-memory caching to avoid redundant network requests.
 *
 * NOTE: This module is designed for demonstration and may need updates if provider
 * pricing pages or APIs change their structure. Scraping HTML is inherently fragile.
 * In a real-world, high-stakes application, using official pricing APIs is preferred.
 */

import { request } from 'undici';
import { getDefaultModels } from './models.js';

/**
 * @typedef {import('./models.js').ModelData} ModelData
 */

/**
 * In-memory cache to store fetched pricing data.
 * The key is the provider name (e.g., 'openai'), and the value is the fetched data.
 *
 * @type {Map<string, { data: ModelData, timestamp: number }>}
 */
const pricingCache = new Map();

/**
 * The duration for which cached data is considered valid, in milliseconds.
 * Set to 24 hours.
 * @type {number}
 */
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * User-Agent header to mimic a browser and avoid being blocked.
 * @type {string}
 */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Fetches the latest pricing data for all supported providers.
 * It attempts to fetch from live sources and falls back to default pricing on failure.
 * Results are cached in memory to reduce network requests.
 *
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.force=false] - If true, bypasses the cache and forces a fresh fetch.
 * @returns {Promise<ModelData>} A promise that resolves to the combined pricing data from all providers.
 */
export async function fetchAllPricingData({ force = false } = {}) {
  const providers = ['openai', 'anthropic'];
  const fetchPromises = providers.map(provider => fetchPricingData(provider, { force }));

  try {
    const results = await Promise.all(fetchPromises);
    // Merge results from all providers into a single ModelData object.
    return results.reduce((acc, providerData) => {
      return { ...acc, ...providerData };
    }, {});
  } catch (error) {
    console.error('Failed to fetch one or more provider pricing data. Using default models as a fallback.', error);
    return getDefaultModels();
  }
}

/**
 * Fetches pricing data for a specific provider.
 * Manages caching logic before dispatching to the provider-specific fetcher.
 *
 * @param {string} provider - The provider to fetch data for (e.g., 'openai', 'anthropic').
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.force=false] - If true, bypasses the cache and forces a fresh fetch.
 * @returns {Promise<ModelData>} A promise that resolves to the provider's pricing data.
 */
export async function fetchPricingData(provider, { force = false } = {}) {
  const cachedEntry = pricingCache.get(provider);
  const now = Date.now();

  if (!force && cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
    // Return a clone to prevent mutation of the cached object.
    return structuredClone(cachedEntry.data);
  }

  try {
    let pricingData;
    switch (provider) {
      case 'openai':
        // OpenAI does not have a simple public pricing API.
        // We will rely on the default static data for now.
        // A real implementation might scrape their pricing page.
        console.warn('OpenAI pricing fetch is not implemented; using static fallback data. Scraping is fragile and not included by default.');
        pricingData = { openai: getDefaultModels().openai };
        break;
      case 'anthropic':
        // Anthropic also lacks a simple public pricing API.
        // Relying on default static data.
        console.warn('Anthropic pricing fetch is not implemented; using static fallback data. Scraping is fragile and not included by default.');
        pricingData = { anthropic: getDefaultModels().anthropic };
        break;
      default:
        throw new Error(`Unsupported provider for pricing fetch: ${provider}`);
    }

    pricingCache.set(provider, { data: structuredClone(pricingData), timestamp: now });
    return pricingData;
  } catch (error) {
    console.error(`Error fetching pricing for ${provider}: ${error.message}. Falling back to default data.`);
    // On failure, return the static data for that provider.
    const defaultData = getDefaultModels();
    const fallbackData = { [provider]: defaultData[provider] };

    if (!fallbackData[provider]) {
      throw new Error(`No default pricing data found for provider: ${provider}`);
    }
    // Do not cache failures, allowing for retries on subsequent calls.
    return fallbackData;
  }
}

/**
 * Clears the in-memory pricing cache.
 * Useful for testing or forcing a refresh of all data.
 */
export function clearCache() {
  pricingCache.clear();
}

/**
 * A placeholder for a potential OpenAI pricing page scraper.
 * NOTE: This is non-functional and for illustrative purposes only. Web scraping is
 * highly dependent on the page's HTML structure and can break easily.
 *
 * @returns {Promise<ModelData>}
 * @private
 */
async function _fetchOpenAIPricing() {
  const url = 'https://openai.com/pricing';
  console.warn(`Note: Scraping ${url} is fragile and not implemented. Using fallback data.`);
  // Example of what a request might look like:
  // const { body } = await request(url, {
  //   headers: { 'User-Agent': USER_AGENT }
  // });
  // const html = await body.text();
  // ... parsing logic would go here ...
  return Promise.resolve({ openai: getDefaultModels().openai });
}

/**
 * A placeholder for a potential Anthropic pricing page scraper.
 * NOTE: This is non-functional and for illustrative purposes only.
 *
 * @returns {Promise<ModelData>}
 * @private
 */
async function _fetchAnthropicPricing() {
  const url = 'https://www.anthropic.com/pricing';
  console.warn(`Note: Scraping ${url} is fragile and not implemented. Using fallback data.`);
  return Promise.resolve({ anthropic: getDefaultModels().anthropic });
}