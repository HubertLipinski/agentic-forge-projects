/**
 * @file src/core/scanner.js
 * @description Orchestrates the entire process: recursively finds Markdown files,
 * uses the parser to get links, and invokes the validator for each link.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseMarkdownFile } from '../parser/markdown-parser.js';
import { validateLink } from '../validation/link-validator.js';
import { SUPPORTED_MARKDOWN_EXTENSIONS, LINK_STATUS } from '../util/constants.js';
import logger from '../util/logger.js';

/**
 * A utility function to introduce a delay.
 * Used to rate-limit requests to avoid being blocked.
 * @param {number} ms - The delay time in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Checks if a given URL should be ignored based on the configured patterns.
 * @param {string} url - The URL to check.
 * @param {RegExp[]} ignorePatterns - An array of RegExp objects.
 * @returns {boolean} True if the URL matches any ignore pattern, false otherwise.
 */
function isIgnored(url, ignorePatterns) {
  if (!ignorePatterns || ignorePatterns.length === 0) {
    return false;
  }
  return ignorePatterns.some(pattern => pattern.test(url));
}

/**
 * Recursively finds all Markdown files in a given directory path.
 *
 * @param {string} dirPath - The directory to search.
 * @returns {AsyncGenerator<string>} An async generator that yields the full path of each Markdown file found.
 */
async function* findMarkdownFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Recursively search in subdirectories.
        yield* findMarkdownFiles(fullPath);
      } else if (entry.isFile() && SUPPORTED_MARKDOWN_EXTENSIONS.includes(path.extname(entry.name))) {
        // Yield the full path if it's a supported Markdown file.
        yield fullPath;
      }
    }
  } catch (error) {
    // Log an error if a directory cannot be read, but continue the process.
    logger.warn(`Could not read directory: ${dirPath}. Reason: ${error.message}`);
  }
}

/**
 * Scans a list of file and directory paths, extracts all links from Markdown files,
 * validates them, and returns a comprehensive report.
 *
 * @param {string[]} paths - An array of file and directory paths to scan.
 * @param {import('../config/config-loader.js').AppConfig} config - The application configuration.
 * @returns {Promise<import('../validation/link-validator.js').ValidationResult[]>} A promise that resolves to an array of validation results.
 */
export async function scan(paths, config) {
  const allLinks = [];
  const filesToProcess = new Set();

  // 1. Collect all Markdown files to be processed.
  for (const p of paths) {
    try {
      const stats = await fs.stat(p);
      if (stats.isDirectory()) {
        for await (const filePath of findMarkdownFiles(p)) {
          filesToProcess.add(filePath);
        }
      } else if (stats.isFile() && SUPPORTED_MARKDOWN_EXTENSIONS.includes(path.extname(p))) {
        filesToProcess.add(p);
      }
    } catch (error) {
      logger.error(`Invalid path provided: ${p}. ${error.message}`);
    }
  }

  if (filesToProcess.size === 0) {
    logger.warn('No Markdown files found to scan.');
    return [];
  }

  // 2. Parse all collected files and extract links.
  logger.header('Parsing Markdown Files...');
  for (const filePath of filesToProcess) {
    try {
      const links = await parseMarkdownFile(filePath);
      allLinks.push(...links);
      logger.success(`Parsed ${filePath} (${links.length} links found)`);
    } catch (error) {
      logger.error(`Failed to parse ${filePath}: ${error.message}`);
    }
  }

  if (allLinks.length === 0) {
    logger.warn('No links found in the specified files.');
    return [];
  }

  // 3. Validate all extracted links.
  logger.header(`Validating ${allLinks.length} Links...`);
  const validationPromises = [];
  let httpLinkCounter = 0;

  for (const link of allLinks) {
    // Check if the link should be ignored.
    if (isIgnored(link.url, config.ignore)) {
      const ignoredResult = {
        ...link,
        status: LINK_STATUS.IGNORED,
      };
      validationPromises.push(Promise.resolve(ignoredResult));
      continue;
    }

    // Apply a delay before each HTTP request to avoid rate-limiting.
    const isHttp = link.url.startsWith('http');
    const validationPromise = (async () => {
      if (isHttp && config.requestDelay > 0) {
        // The delay is applied sequentially within this async IIFE.
        await sleep(httpLinkCounter * config.requestDelay);
        httpLinkCounter++;
      }
      return validateLink(link, config);
    })();

    validationPromises.push(validationPromise);
  }

  // Await all validation promises to complete.
  // Using Promise.allSettled ensures we get results even if some validations fail unexpectedly.
  const settledResults = await Promise.allSettled(validationPromises);

  const results = settledResults.map(res => {
    if (res.status === 'fulfilled') {
      return res.value;
    }
    // This should rarely happen, as validateLink is designed to not reject.
    // It indicates a catastrophic failure in the validation logic itself.
    logger.error(`A validation promise failed unexpectedly: ${res.reason.message}`);
    return null; // This will be filtered out later.
  }).filter(Boolean); // Filter out any nulls from rejected promises.

  return results;
}