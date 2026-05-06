/**
 * @file src/generator/template-renderer.js
 * @description Uses EJS to render code templates with structured data.
 *
 * This module is responsible for loading EJS template files from the filesystem
 * and rendering them with the data provided by the analyzer and transformer modules.
 * It provides a clean, asynchronous interface for generating source code strings
 * from templates, forming a key part of the code generation pipeline.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';

// Determine the root directory of the project to locate the templates folder.
// This is robust and works regardless of where the script is executed from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates');

/**
 * A cache for loaded EJS templates to avoid redundant file I/O.
 * Reading the same template file multiple times per generation cycle is inefficient.
 * @type {Map<string, string>}
 */
const templateCache = new Map();

/**
 * Loads a template file from the `templates` directory.
 * It uses a cache to avoid reading the same file from disk multiple times.
 *
 * @param {string} templateName - The name of the template file (e.g., 'server.js.ejs').
 * @returns {Promise<string>} A promise that resolves to the content of the template file.
 * @throws {Error} If the template file cannot be found or read.
 */
async function loadTemplate(templateName) {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const templatePath = path.join(TEMPLATES_DIR, templateName);

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    templateCache.set(templateName, content);
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Template file not found: "${templatePath}"`);
    }
    // Re-throw other errors (e.g., permission denied) with context.
    throw new Error(
      `Failed to read template file "${templatePath}": ${error.message}`,
    );
  }
}

/**
 * Renders a specified EJS template with the given data.
 *
 * This is the core function of the module. It orchestrates loading the template
 * and using the EJS engine to produce the final rendered string. It's designed
 * to be asynchronous to align with the file I/O operations.
 *
 * @param {string} templateName - The name of the template to render (e.g., 'server.js.ejs').
 * @param {object} data - The data object to pass to the EJS template. This object
 *                        will be available within the template.
 * @returns {Promise<string>} A promise that resolves to the rendered string content.
 * @throws {Error} If the template cannot be loaded or if EJS rendering fails.
 */
export async function renderTemplate(templateName, data = {}) {
  if (typeof templateName !== 'string' || !templateName) {
    throw new Error('Invalid input: `templateName` must be a non-empty string.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid input: `data` must be an object.');
  }

  try {
    const templateContent = await loadTemplate(templateName);

    // EJS rendering can be synchronous, but we wrap it in an async function
    // to maintain a consistent async API and handle potential future async
    // features in EJS or our templates (e.g., async includes).
    const renderedContent = ejs.render(templateContent, data, {
      async: false, // Keep EJS's core rendering synchronous for performance.
      filename: path.join(TEMPLATES_DIR, templateName), // Helps EJS provide better error messages.
    });

    return renderedContent;
  } catch (error) {
    // Add context to errors thrown from `loadTemplate` or `ejs.render`.
    throw new Error(
      `Failed to render template "${templateName}": ${error.message}`,
    );
  }
}

/**
 * Clears the internal template cache.
 * This is primarily useful for testing or in long-running watch-mode scenarios
 * where templates might change on disk and need to be reloaded.
 */
export function clearTemplateCache() {
  templateCache.clear();
}