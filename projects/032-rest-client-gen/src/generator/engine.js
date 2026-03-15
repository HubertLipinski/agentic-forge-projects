/**
 * @file src/generator/engine.js
 * @description The core code generation engine. It loads Mustache templates,
 * combines them with the prepared data model, and renders the final JavaScript code string.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Mustache from 'mustache';

/**
 * A custom error class for issues encountered during the template rendering process.
 */
class RenderError extends Error {
  /**
   * @param {string} message - A descriptive error message.
   * @param {Error} [cause] - The underlying error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'RenderError';
    if (cause) {
      this.cause = cause;
    }
  }
}

// Disable HTML escaping for Mustache, as we are generating JavaScript code, not HTML.
// This prevents characters like '<' or '>' from being converted to '&lt;' or '&gt;'.
Mustache.escape = (text) => text;

// Determine the directory of the current module to locate template files reliably.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const CLIENT_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'client.mustache');
const METHOD_PARTIAL_PATH = path.join(TEMPLATES_DIR, 'method.mustache');

/**
 * Loads the main client template and the method partial template from the filesystem.
 *
 * This function is designed to be called once to cache the template content.
 * It reads the template files asynchronously and returns their contents.
 *
 * @returns {Promise<{mainTemplate: string, partials: {method: string}}>} An object containing the main template string and the method partial.
 * @throws {RenderError} If a template file cannot be read.
 */
const loadTemplates = async () => {
  try {
    const [mainTemplate, methodPartial] = await Promise.all([
      fs.readFile(CLIENT_TEMPLATE_PATH, 'utf-8'),
      fs.readFile(METHOD_PARTIAL_PATH, 'utf-8'),
    ]);

    return {
      mainTemplate,
      partials: {
        method: methodPartial,
      },
    };
  } catch (error) {
    throw new RenderError(`Failed to load template files from '${TEMPLATES_DIR}'. Please ensure the templates exist and are readable.`, error);
  }
};

// Load templates when the module is initialized.
// This promise can be awaited by the main generation function,
// ensuring templates are loaded only once per application lifecycle.
const templatesPromise = loadTemplates();

/**
 * Generates the client code as a string using the prepared data and Mustache templates.
 *
 * This is the core rendering function. It waits for the templates to be loaded,
 * then uses Mustache to render the final code by combining the main template,
 * the prepared data model, and any partial templates.
 *
 * @param {object} preparedData - The data model prepared by `preparer.js`.
 * @returns {Promise<string>} A promise that resolves to the generated JavaScript code as a string.
 * @throws {RenderError} If the rendering process fails.
 */
export const generateClientCode = async (preparedData) => {
  try {
    const { mainTemplate, partials } = await templatesPromise;

    // The Mustache.render function synchronously returns the rendered string.
    const output = Mustache.render(mainTemplate, preparedData, partials);
    return output;
  } catch (error) {
    // This could catch errors from Mustache.render if the data is malformed
    // in a way that the library can't handle, or from the template loading promise.
    if (error instanceof RenderError) {
      throw error; // Re-throw our custom error
    }
    throw new RenderError('An unexpected error occurred during code generation.', error);
  }
};