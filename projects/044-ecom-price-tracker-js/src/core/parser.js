import * as cheerio from 'cheerio';

/**
 * Custom error class for parsing-related failures.
 * This helps distinguish data extraction errors from network or configuration errors.
 */
class ParserError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details={}] Additional context about the error.
   * @param {string} [details.selector] The CSS selector that failed.
   * @param {string} [details.field] The data field being extracted (e.g., 'price', 'name').
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ParserError';
    this.details = details;
  }
}

/**
 * Cleans and normalizes a string by removing extra whitespace, newlines, and tabs.
 *
 * @param {string | null | undefined} text The input string to clean.
 * @returns {string | null} The cleaned string, or null if the input is empty or invalid.
 */
const cleanText = (text) => {
  if (typeof text !== 'string' || !text) {
    return null;
  }
  // Replace multiple whitespace characters (including newlines and tabs) with a single space, then trim.
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Extracts a numerical value from a string, typically a price.
 * It removes currency symbols, thousands separators, and handles decimal points.
 *
 * @param {string | null} text The string containing the price (e.g., "$1,299.99").
 * @returns {number | null} The extracted number, or null if no number could be found.
 */
const extractNumber = (text) => {
  if (!text) {
    return null;
  }
  // Remove common currency symbols, letters, and thousands separators.
  // This regex is designed to be robust for various formats.
  const numericString = text.replace(/[^\d.,-]/g, '').replace(',', '.');

  // Find the first valid floating-point number in the string.
  const match = numericString.match(/-?\d+(\.\d+)?/);

  if (match) {
    return parseFloat(match[0]);
  }

  return null;
};

/**
 * Extracts a single value from the Cheerio context using a selector configuration.
 * It handles different extraction methods ('text', 'attr') and applies post-processing.
 *
 * @param {import('cheerio').CheerioAPI} $ The Cheerio instance loaded with the HTML.
 * @param {object} selectorConfig The configuration for a single selector.
 * @param {string} selectorConfig.selector The CSS selector string.
 * @param {string} [selectorConfig.method='text'] The extraction method ('text' or 'attr').
 * @param {string} [selectorConfig.attribute] The attribute name to extract if method is 'attr'.
 * @returns {string | null} The extracted and cleaned value, or null if not found.
 * @throws {ParserError} If the configuration is invalid (e.g., 'attr' method without an attribute).
 */
const extractValue = ($, selectorConfig) => {
  const { selector, method = 'text', attribute } = selectorConfig;
  const element = $(selector).first();

  if (!element.length) {
    return null;
  }

  let rawValue;
  if (method === 'text') {
    rawValue = element.text();
  } else if (method === 'attr') {
    if (!attribute) {
      throw new ParserError(`Selector configuration for '${selector}' uses 'attr' method but is missing the 'attribute' key.`);
    }
    rawValue = element.attr(attribute);
  } else {
    throw new ParserError(`Unsupported extraction method '${method}' for selector '${selector}'.`);
  }

  return cleanText(rawValue);
};

/**
 * Parses raw HTML content using Cheerio and a site-specific configuration
 * to extract product information like name, price, and stock availability.
 *
 * @param {string} html The raw HTML content of the product page.
 * @param {object} siteConfig The configuration object for the specific e-commerce site.
 * @param {object} siteConfig.selectors The map of selectors for different data fields.
 * @returns {Promise<{name: string | null, price: number | null, isInStock: boolean | null}>}
 *          A promise that resolves to an object containing the extracted product data.
 *          Fields will be `null` if the corresponding selector did not find a match.
 * @throws {ParserError} If a required selector is missing or data extraction fails.
 */
export async function parseProductData(html, siteConfig) {
  if (!html || typeof html !== 'string') {
    throw new ParserError('Invalid input: HTML content must be a non-empty string.');
  }
  if (!siteConfig?.selectors) {
    throw new ParserError('Invalid input: Site configuration must include a `selectors` object.');
  }

  const $ = cheerio.load(html);
  const { selectors } = siteConfig;

  // --- Extract Product Name ---
  const nameSelector = selectors.name;
  if (!nameSelector) {
    throw new ParserError("Configuration error: 'name' selector is missing.", { field: 'name' });
  }
  const name = extractValue($, nameSelector);

  // --- Extract Product Price ---
  const priceSelector = selectors.price;
  if (!priceSelector) {
    throw new ParserError("Configuration error: 'price' selector is missing.", { field: 'price' });
  }
  const priceText = extractValue($, priceSelector);
  const price = extractNumber(priceText);

  // --- Determine Stock Availability ---
  let isInStock = null;
  if (selectors.stock) {
    const stockText = extractValue($, selectors.stock);
    if (stockText && siteConfig.stock?.inStockStrings) {
      // Check if the extracted text includes any of the "in stock" phrases.
      // The check is case-insensitive.
      const lowercasedStockText = stockText.toLowerCase();
      isInStock = siteConfig.stock.inStockStrings.some(phrase =>
        lowercasedStockText.includes(phrase.toLowerCase())
      );
    } else if (stockText) {
      // If `inStockStrings` is not defined, we can't reliably determine status.
      // We log a warning as this might be a configuration oversight.
      console.warn(`Warning: Stock text was found for selector '${selectors.stock.selector}', but no 'inStockStrings' are defined in the site config to determine availability.`);
    }
  }

  // A basic validation: if name or price is missing, the page might not be a valid product page.
  if (name === null) {
    console.warn(`Warning: Product name could not be extracted using selector '${nameSelector.selector}'. The page structure may have changed.`);
  }
  if (price === null) {
    console.warn(`Warning: Product price could not be extracted using selector '${priceSelector.selector}'.`);
  }

  return {
    name,
    price,
    isInStock,
  };
}