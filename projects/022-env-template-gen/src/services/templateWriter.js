/**
 * @file src/services/templateWriter.js
 * @description Takes a list of environment variable names and writes them to a formatted .env.template file.
 * This service handles the final step of generating the output file.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TEMPLATE_HEADER, DEFAULT_OUTPUT_FILE } from '../utils/constants.js';

/**
 * Generates the content for the .env.template file.
 * The content includes a header and a list of environment variables,
 * each set to an empty string.
 *
 * @param {string[]} envVars - A sorted array of unique environment variable names.
 * @returns {string} The complete, formatted string content for the template file.
 */
function generateTemplateContent(envVars) {
  // Ensure envVars is an array to prevent errors.
  if (!Array.isArray(envVars)) {
    // This is an internal function, so this case indicates a programming error.
    // We'll return the header only to create a valid but empty template.
    console.warn('[Warning] generateTemplateContent received a non-array input. Generating an empty template.');
    return `${TEMPLATE_HEADER}\n`;
  }

  // Create the main body of the template by mapping each variable to "VAR=".
  const variableLines = envVars.map(varName => `${varName}=`).join('\n');

  // Combine the header and the variable lines.
  // Add an extra newline between the header and the variables for better readability.
  const content = `${TEMPLATE_HEADER}\n\n${variableLines}\n`;

  return content;
}

/**
 * Writes the generated environment variable template to a specified file.
 * It creates the necessary directories if they don't exist and then writes
 * the content to the file, overwriting it if it already exists.
 *
 * @async
 * @function writeTemplateFile
 * @param {object} options - The configuration options for writing the file.
 * @param {string[]} options.envVars - An array of environment variable names to include in the template.
 * @param {string} [options.outputPath=DEFAULT_OUTPUT_FILE] - The path where the template file should be saved.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {Error} If the file cannot be written due to permissions or other filesystem errors.
 */
export async function writeTemplateFile({
  envVars,
  outputPath = DEFAULT_OUTPUT_FILE,
}) {
  if (!envVars) {
    throw new Error('`envVars` array must be provided to writeTemplateFile.');
  }

  const content = generateTemplateContent(envVars);
  const absolutePath = path.resolve(process.cwd(), outputPath);

  try {
    // Ensure the directory for the output file exists.
    // `recursive: true` prevents errors if the directory already exists.
    const outputDir = path.dirname(absolutePath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the content to the specified file path.
    // This will create the file if it doesn't exist or overwrite it if it does.
    await fs.writeFile(absolutePath, content, 'utf-8');

  } catch (error) {
    // Provide a detailed error message if the file writing operation fails.
    // This is a critical failure, so we re-throw the error to halt the process.
    console.error(`[Error] Failed to write template file to: ${absolutePath}`);
    // Common causes include file system permissions or an invalid path.
    throw new Error(`Could not write to output file: ${error.message}`);
  }
}