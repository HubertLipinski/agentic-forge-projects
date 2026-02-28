/**
 * @fileoverview A factory for creating parser functions based on job definitions.
 *
 * This module provides a centralized mechanism for selecting the appropriate
 * parsing strategy for a given scraping job. It decouples the core worker logic
 * from the implementation details of individual parsers, making the system
- * extensible and easy to maintain. By registering different parsing functions,
 * new data extraction methods (e.g., for different content types like XML or
 * custom binary formats) can be added without modifying the worker's scraping
 * lifecycle.
 */

import * as cheerio from 'cheerio';
import { getLogger } from '../utils/logger.js';

const logger = getLogger().child({ service: 'ParserFactory' });

/**
 * A function that parses raw response content into structured data.
 *
 * @callback ParserFunction
 * @param {string} content - The raw string content from the HTTP response body.
 * @param {object} job - The original job object, providing context and metadata.
 * @returns {Promise<object|string|Array<any>>} The extracted data. The structure is
 * determined by the parser's implementation.
 * @throws {Error} If parsing fails.
 */

/**
 * Parses HTML content using Cheerio, a fast, flexible, and lean implementation
 * of core jQuery designed specifically for the server.
 *
 * This parser is intended for jobs targeting traditional HTML web pages. It loads
 * the HTML content into a Cheerio object, which can then be queried with CSS selectors
 * to extract data.
 *
 * **Note:** This is a placeholder implementation. In a real-world scenario, this
 * function would be extended to use selectors and data extraction logic defined
 * within the job object itself (e.g., `job.parserOptions.selectors`). For this
 * project's scope, it returns the page title as a demonstration.
 *
 * @type {ParserFunction}
 */
async function parseHtmlWithCheerio(content, job) {
  try {
    const $ = cheerio.load(content);
    const title = $('title').text().trim();
    const h1 = $('h1').first().text().trim();

    logger.debug({ jobId: job.id }, 'Successfully parsed HTML with Cheerio.');

    // A sample data structure. A real implementation would be more complex.
    return {
      title,
      h1,
      url: job.url,
    };
  } catch (error) {
    logger.error({ jobId: job.id, err: error.message }, 'Failed to parse HTML with Cheerio.');
    // Re-throw to ensure the error is propagated and the job is marked as failed.
    throw new Error(`Cheerio parsing failed for job ${job.id}: ${error.message}`);
  }
}

/**
 * A passthrough parser for JSON content.
 *
 * This parser attempts to parse the content string as JSON. If successful, it
 * returns the resulting JavaScript object or array. It's useful for scraping
 * JSON APIs or endpoints that return data in JSON format.
 *
 * If the content is not valid JSON, it throws an error.
 *
 * @type {ParserFunction}
 */
async function parseJsonPassthrough(content, job) {
  try {
    const data = JSON.parse(content);
    logger.debug({ jobId: job.id }, 'Successfully parsed content as JSON.');
    return data;
  } catch (error) {
    // This is a common case if an API returns an HTML error page instead of JSON.
    logger.error({ jobId: job.id, err: error.message }, 'Failed to parse content as JSON.');
    throw new Error(`JSON passthrough parsing failed for job ${job.id}: Invalid JSON content.`);
  }
}

/**
 * A map that registers available parser types to their corresponding functions.
 *
 * This registry is the core of the factory. To add a new parser, simply add an
 * entry to this map with a unique key (the parser name) and the parsing function.
 *
 * @type {Map<string, ParserFunction>}
 */
const parserRegistry = new Map([
  ['html-cheerio', parseHtmlWithCheerio],
  ['json-passthrough', parseJsonPassthrough],
]);

/**
 * Retrieves a parser function based on the specified parser type.
 *
 * This is the main factory function. It looks up the requested parser in the
 * `parserRegistry`. If a matching parser is found, it returns the function.
 * If not, it throws an error to prevent a worker from processing a job with an
 * unsupported parser type.
 *
 * @param {string} parserType - The name of the parser to retrieve (e.g., 'html-cheerio').
 * @returns {ParserFunction} The corresponding parser function.
 * @throws {Error} If the `parserType` is not found in the registry.
 */
export function getParser(parserType) {
  if (!parserType) {
    throw new Error('Parser type cannot be null or empty.');
  }

  const parserFn = parserRegistry.get(parserType);

  if (!parserFn) {
    logger.error({ parserType }, 'Attempted to get an unknown parser.');
    throw new Error(`Unsupported parser type: "${parserType}". Available parsers: [${[...parserRegistry.keys()].join(', ')}]`);
  }

  return parserFn;
}