/**
 * @fileoverview Parser for YAML/YML configuration files.
 *
 * This module is responsible for reading and parsing a YAML file into a
 * standard JavaScript object. It uses the 'js-yaml' library for parsing
 * and leverages the shared file-reading utilities to ensure consistent
 * error handling for I/O operations. It also provides specific error
 * feedback for YAML syntax issues.
 */

import yaml from 'js-yaml';
import { readFileContent } from '../utils/file-utils.js';

/**
 * Parses a YAML string into a JavaScript object.
 * This is a synchronous wrapper around `yaml.load` with enhanced error handling.
 *
 * @param {string} content - The YAML string content to parse.
 * @param {string} filePath - The original file path, used for context in error messages.
 * @returns {object} The parsed JavaScript object.
 * @throws {Error} Throws a detailed error if the YAML content is malformed or if the
 *   root of the document is not a key-value object.
 */
function parseYamlContent(content, filePath) {
  try {
    // yaml.load can return any valid YAML type (string, number, array, object, null).
    const data = yaml.load(content);

    // For configuration files, we expect a key-value structure at the root.
    // While other types are valid YAML, they are not valid for our use case.
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      const dataType = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
      throw new Error(`The root of the YAML file must be an object. Found type: ${dataType}.`);
    }

    return data;
  } catch (error) {
    // Catch syntax errors from js-yaml and re-throw with more context.
    // The error message from js-yaml is typically descriptive (e.g., "bad indentation").
    throw new Error(`Failed to parse YAML file at "${filePath}". Reason: ${error.message}`);
  }
}

/**
 * Asynchronously reads a YAML file from the specified path and parses it into a JavaScript object.
 *
 * This function orchestrates the file reading and parsing process, ensuring that
 * I/O errors and YAML syntax errors are handled gracefully and reported with
 * helpful, user-friendly messages.
 *
 * @param {string} filePath - The path to the YAML file (e.g., 'config.yaml' or 'config.yml').
 * @returns {Promise<object>} A promise that resolves to the parsed JavaScript object.
 * @throws {Error} Throws if the file cannot be read, is not valid YAML, or if the
 *   root of the YAML document is not an object.
 */
export async function parseYamlFile(filePath) {
  const fileContent = await readFileContent(filePath);
  const parsedData = parseYamlContent(fileContent, filePath);
  return parsedData;
}