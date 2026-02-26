/**
 * @file src/core/converter.js
 * @description Core logic for converting between INI and .env data structures.
 *
 * This module orchestrates the transformation between the structured object
 * representation of an INI file (with sections) and the flat key-value
 * representation of a .env file. It leverages utility functions for string
 * formatting to apply configurable rules for key prefixing and case transformation.
 */

import { applyCase, prefixKey } from '../utils/string-format.js';

/**
 * Validates the options object for conversion functions.
 * @param {object} options - The options to validate.
 * @throws {TypeError} If options are invalid.
 */
function validateOptions(options) {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('Options must be a non-null object.');
  }
  if (
    options.caseType &&
    (typeof options.caseType !== 'string' || options.caseType.length === 0)
  ) {
    throw new TypeError('options.caseType must be a non-empty string.');
  }
  if (
    options.prefixDelimiter &&
    typeof options.prefixDelimiter !== 'string'
  ) {
    throw new TypeError('options.prefixDelimiter must be a string.');
  }
}

/**
 * Converts a structured INI data object to a flat .env key-value object.
 *
 * This function iterates through the INI data, which may contain top-level
 * keys and section objects. It flattens the structure by prefixing keys from
 * sections with the section name. It also applies case transformations to both
 * section names and keys to generate valid and conventional .env variable names.
 *
 * @param {object} iniData - The parsed INI data object.
 * @param {object} [options={}] - Configuration for the conversion.
 * @param {string} [options.caseType='SNAKE_CASE'] - The target case for keys (e.g., 'SNAKE_CASE').
 * @param {string} [options.prefixDelimiter='_'] - The delimiter for joining section and key.
 * @returns {Record<string, string>} A flat object suitable for a .env file.
 * @throws {Error} If case transformation fails or inputs are invalid.
 */
export function convertIniToEnv(iniData, options = {}) {
  if (iniData === null || typeof iniData !== 'object' || Array.isArray(iniData)) {
    throw new TypeError('Input iniData must be a non-null object.');
  }
  validateOptions(options);

  const {
    caseType = 'SNAKE_CASE',
    prefixDelimiter = '_',
  } = options;

  const envData = {};

  for (const key in iniData) {
    // This check is crucial to avoid processing properties from Object.prototype
    if (!Object.hasOwn(iniData, key)) continue;

    const value = iniData[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // This is an INI section.
      const sectionName = key;
      const transformedSection = applyCase(sectionName, caseType);

      for (const sectionKey in value) {
        if (!Object.hasOwn(value, sectionKey)) continue;

        const sectionValue = value[sectionKey];
        const transformedKey = applyCase(sectionKey, caseType);
        const finalKey = prefixKey(transformedKey, transformedSection, prefixDelimiter);

        // Coerce value to string, as .env values are strings.
        // Handles numbers, booleans, etc., gracefully.
        envData[finalKey] = String(sectionValue ?? '');
      }
    } else {
      // This is a top-level key.
      const transformedKey = applyCase(key, caseType);

      // Top-level keys are not prefixed.
      envData[transformedKey] = String(value ?? '');
    }
  }

  return envData;
}

/**
 * Converts a flat .env key-value object to a structured INI data object.
 *
 * This function performs the reverse of `convertIniToEnv`. It attempts to
 * reconstruct INI sections by splitting keys based on a delimiter. Keys that
 * cannot be split are treated as top-level INI properties.
 *
 * Note: This conversion is inherently lossy regarding original INI key casing,
 * as .env keys are typically uniformly cased (e.g., SNAKE_CASE). The original
 * casing cannot be recovered.
 *
 * @param {Record<string, string>} envData - The flat key-value object from a .env file.
 * @param {object} [options={}] - Configuration for the conversion.
 * @param {string} [options.prefixDelimiter='_'] - The delimiter used to identify sections in keys.
 * @returns {object} A structured object representing INI data.
 */
export function convertEnvToIni(envData, options = {}) {
  if (envData === null || typeof envData !== 'object' || Array.isArray(envData)) {
    throw new TypeError('Input envData must be a non-null object.');
  }
  validateOptions(options);

  const { prefixDelimiter = '_' } = options;
  const iniData = {};

  for (const key in envData) {
    if (!Object.hasOwn(envData, key)) continue;

    const value = envData[key];
    const parts = key.split(prefixDelimiter);

    if (parts.length > 1) {
      // Potentially a key with a section prefix.
      // We assume the first part is the section and the rest is the key.
      // e.g., "DATABASE_USER_NAME" -> section "DATABASE", key "USER_NAME"
      const section = parts[0];
      const sectionKey = parts.slice(1).join(prefixDelimiter);

      // Ensure section is a valid identifier and key is not empty
      if (section && sectionKey) {
        // Initialize section object if it doesn't exist.
        if (!iniData[section]) {
          iniData[section] = {};
        } else if (typeof iniData[section] !== 'object' || iniData[section] === null) {
          // Handle case where a top-level key has the same name as a section.
          // The section takes precedence. This is an edge case.
          console.warn(
            `Key "${section}" conflicts with a section name. The section will overwrite the top-level key.`
          );
          iniData[section] = {};
        }
        iniData[section][sectionKey] = value;
      } else {
        // Treat as a top-level key if splitting results in an empty section or key.
        iniData[key] = value;
      }
    } else {
      // No delimiter found, treat as a top-level key.
      iniData[key] = value;
    }
  }

  return iniData;
}