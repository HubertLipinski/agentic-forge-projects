import path from 'node:path';
import Mustache from 'mustache';
import {
  readFileContent,
  writeFileContent,
  resolveTemplatePath,
  pathExists,
} from './utils/file-system.js';
import { parsePackageFile } from './parsers/package-parser.js';
import { parseJsdoc } from './parsers/jsdoc-parser.js';
import { parseLicenseFile } from './parsers/license-parser.js';

/**
 * @typedef {object} EngineOptions
 * @property {string} [template='default'] - The name of a built-in template or the path to a custom template file.
 * @property {string[]} [entry=[]] - An array of file paths or glob patterns for JSDoc parsing.
 * @property {string} [output='README.md'] - The path for the generated output file.
 * @property {string} [projectRoot=process.cwd()] - The root directory of the project to analyze.
 */

/**
 * Custom error class for the template rendering engine.
 */
class EngineError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Optional parameters.
   * @param {Error} [options.cause] The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'EngineError';
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

/**
 * Gathers all necessary data by invoking the various parsers.
 * This function aggregates information from package.json, JSDoc comments,
 * license files, and contribution guidelines.
 *
 * @param {string} projectRoot - The root directory of the project.
 * @param {string[]} entryFiles - Glob patterns for source files to parse for JSDoc.
 * @returns {Promise<object>} A promise that resolves to the aggregated data object for template rendering.
 */
async function gatherTemplateData(projectRoot, entryFiles) {
  try {
    const [
      packageData,
      apiDocs,
      licenseInfo,
      hasContributing,
    ] = await Promise.all([
      parsePackageFile(projectRoot),
      parseJsdoc(entryFiles),
      parseLicenseFile(projectRoot),
      pathExists(path.resolve(projectRoot, 'CONTRIBUTING.md')),
    ]);

    // Structure the data for the Mustache template.
    const templateData = {
      project: packageData.project,
      packageManager: packageData.packageManager,
      api: apiDocs,
      license: licenseInfo,
      contributing: hasContributing,
      // A placeholder for badges, allowing users to add them in custom templates.
      badges: true,
    };

    // Clean up the scripts object to be an array of key-value pairs for easier iteration in Mustache.
    if (templateData.project.scripts) {
      templateData.project.scripts = Object.entries(templateData.project.scripts)
        .map(([key, value]) => ({ key, value }));
    }

    return templateData;
  } catch (error) {
    // Catch errors from any of the parsers and wrap them in an EngineError.
    throw new EngineError('Failed to gather project data.', { cause: error });
  }
}

/**
 * Renders the final README content using the provided data and template.
 *
 * @param {string} templateContent - The raw Mustache template string.
 * @param {object} data - The aggregated data object from `gatherTemplateData`.
 * @returns {string} The rendered Markdown content.
 * @throws {EngineError} If an error occurs during Mustache rendering.
 */
function renderReadme(templateContent, data) {
  try {
    // Disable HTML escaping for all variables, as we are generating Markdown.
    // The triple-brace {{{api}}} syntax in the template also achieves this for specific tags.
    Mustache.escape = (text) => text;
    return Mustache.render(templateContent, data);
  } catch (error) {
    throw new EngineError('Failed to render README from template.', { cause: error });
  }
}

/**
 * The main orchestrator for generating a README.md file.
 * It takes CLI options, gathers data, resolves and reads the template,
 * renders the final content, and writes it to the specified output file.
 *
 * @param {EngineOptions} options - Configuration options for the generation process.
 * @returns {Promise<void>} A promise that resolves when the README file has been successfully written.
 * @throws {EngineError | import('./utils/file-system.js').FileSystemError} If any step in the process fails.
 */
export async function generateReadme(options = {}) {
  const {
    template = 'default',
    entry = [],
    output = 'README.md',
    projectRoot = process.cwd(),
  } = options;

  console.log(`[Engine] Starting README generation for project at: ${projectRoot}`);

  // 1. Resolve template path and read its content.
  const templatePath = await resolveTemplatePath(template);
  console.log(`[Engine] Using template: ${templatePath}`);
  const templateContent = await readFileContent(templatePath);

  // 2. Gather all data from project files.
  console.log('[Engine] Parsing project files...');
  const templateData = await gatherTemplateData(projectRoot, entry);

  // 3. Render the template with the gathered data.
  console.log('[Engine] Rendering template...');
  const renderedContent = renderReadme(templateContent, templateData);

  // 4. Write the final content to the output file.
  const outputPath = path.resolve(projectRoot, output);
  await writeFileContent(outputPath, renderedContent);
  console.log(`[Engine] ✅ Successfully generated README at: ${outputPath}`);
}