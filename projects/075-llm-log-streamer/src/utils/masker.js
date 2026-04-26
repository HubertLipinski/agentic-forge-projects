/**
 * @file src/utils/masker.js
 * @description Utility function to sanitize log objects by masking sensitive data like API keys.
 *
 * This module provides a flexible and efficient way to redact sensitive information
 * from nested objects and arrays before they are logged. It's designed to prevent
 * accidental leakage of credentials like API keys in application logs.
 */

import { getConfig } from './config.js';

const MASK_TEXT = '********';

// Pre-compute lower-cased sets for case-insensitive and performant lookups.
let maskHeaderSet = new Set();
let maskBodyKeySet = new Set();

/**
 * Initializes the masker with configuration settings.
 * This function should be called once at application startup.
 */
function initializeMasker() {
  const config = getConfig();
  maskHeaderSet = new Set(
    (config.maskHeaders || []).map((header) => header.toLowerCase()),
  );
  maskBodyKeySet = new Set(config.maskBodyKeys || []);
}

// Initialize on module load.
initializeMasker();

/**
 * Recursively traverses an object or array and masks values of specified keys.
 * This function mutates the input object for performance reasons, as it's
 * intended for use on temporary log objects right before serialization.
 *
 * @param {any} data - The object or array to traverse.
 * @param {Set<string>} keysToMask - A Set of keys whose values should be masked.
 * @returns {any} The mutated data object.
 */
function maskRecursive(data, keysToMask) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      maskRecursive(item, keysToMask);
    }
  } else {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (keysToMask.has(key) && data[key] !== null) {
          data[key] = MASK_TEXT;
        } else {
          maskRecursive(data[key], keysToMask);
        }
      }
    }
  }
  return data;
}

/**
 * Sanitizes a log object by masking sensitive data.
 * It creates a deep copy of the input object to avoid side effects on the original data,
 * then masks configured headers and body keys.
 *
 * @param {object} logData - The original log object to be sanitized.
 * @returns {object} A new, sanitized log object.
 */
export function maskData(logData) {
  if (!logData || typeof logData !== 'object') {
    return logData;
  }

  // Use structuredClone for a robust, deep copy.
  const sanitizedData = structuredClone(logData);

  // 1. Mask headers (case-insensitive)
  if (sanitizedData.req?.headers) {
    for (const header in sanitizedData.req.headers) {
      if (maskHeaderSet.has(header.toLowerCase())) {
        sanitizedData.req.headers[header] = MASK_TEXT;
      }
    }
  }

  // 2. Mask body keys (case-sensitive)
  // Mask request body
  if (sanitizedData.req?.body) {
    maskRecursive(sanitizedData.req.body, maskBodyKeySet);
  }

  // Mask response body
  if (sanitizedData.res?.body) {
    maskRecursive(sanitizedData.res.body, maskBodyKeySet);
  }

  return sanitizedData;
}