/**
 * @file src/alerter.js
 * @description Formats and outputs anomaly alerts. Writes structured JSON to stdout or a configured output file.
 *
 * This module acts as the final step in the anomaly detection pipeline. It receives
 * anomaly objects from the analyzers, enriches them with metadata, and then
 * dispatches them to the configured output stream (either the console or a file).
 * It handles I/O operations carefully to prevent the main application loop from
 * being blocked or crashing due to output errors.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {object} AlerterConfig
 * @property {'stdout' | 'file'} output - The destination for alerts.
 * @property {string} [filePath] - The path to the output file, required if output is 'file'.
 */

/**
 * @type {AlerterConfig | null}
 * The configuration for the alerter. Initialized by `initializeAlerter`.
 */
let alerterConfig = null;

/**
 * @type {fs.FileHandle | null}
 * A handle to the output file, if one is being used. This allows for efficient
 * appending without repeatedly opening and closing the file.
 */
let fileHandle = null;

/**
 * Initializes the alerter with the given configuration.
 * This function must be called before `triggerAlert`. It validates the configuration
 * and prepares the output stream (e.g., opens the file handle).
 *
 * @param {AlerterConfig} config - The configuration object for the alerter.
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 * @throws {Error} If the configuration is invalid or the output file cannot be opened.
 */
export async function initializeAlerter(config) {
  if (!config || typeof config.output !== 'string') {
    throw new Error('Alerter configuration is invalid: `output` property is missing or not a string.');
  }

  if (config.output !== 'stdout' && config.output !== 'file') {
    throw new Error(`Alerter configuration is invalid: 'output' must be 'stdout' or 'file', but received '${config.output}'.`);
  }

  if (config.output === 'file') {
    if (typeof config.filePath !== 'string' || config.filePath.trim() === '') {
      throw new Error('Alerter configuration is invalid: `filePath` is required when output is \'file\'.');
    }

    try {
      // Ensure the directory exists before trying to open the file.
      const dir = path.dirname(config.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Open the file for appending. The 'a' flag creates the file if it doesn't exist.
      fileHandle = await fs.open(config.filePath, 'a');
    } catch (error) {
      // Provide a more user-friendly error message for file system issues.
      throw new Error(`Failed to open alert output file at '${config.filePath}': ${error.message}`);
    }
  }

  alerterConfig = { ...config };
  console.log(`Alerter initialized. Outputting alerts to ${alerterConfig.output === 'file' ? alerterConfig.filePath : 'stdout'}.`);
}

/**
 * Formats and triggers an anomaly alert.
 * It takes the raw anomaly data, enriches it with a timestamp, and writes it
 * as a structured JSON string to the configured output.
 *
 * @param {string} type - The type of the anomaly (e.g., 'FREQUENCY_BURST', 'NEW_PATTERN').
 * @param {object} details - An object containing specific details about the anomaly.
 * @returns {Promise<void>} A promise that resolves when the alert has been dispatched.
 */
export async function triggerAlert(type, details) {
  if (!alerterConfig) {
    // This indicates a programming error where initializeAlerter was not called.
    console.error('CRITICAL: Alerter not initialized. Cannot trigger alert. This should not happen.');
    return;
  }

  // Defensive checks for input parameters.
  if (typeof type !== 'string' || !details || typeof details !== 'object') {
    console.error('Invalid alert data received. Cannot trigger alert.', { type, details });
    return;
  }

  const alert = {
    timestamp: new Date().toISOString(),
    type,
    details,
  };

  try {
    const jsonPayload = JSON.stringify(alert);
    await writeAlert(jsonPayload);
  } catch (error) {
    // This could happen if `details` contains circular references, though unlikely with our current data.
    console.error('Failed to serialize alert to JSON:', error);
  }
}

/**
 * Writes the formatted JSON alert string to the configured output stream.
 *
 * @param {string} jsonPayload - The JSON string representing the alert.
 * @returns {Promise<void>}
 * @private
 */
async function writeAlert(jsonPayload) {
  const outputLine = `${jsonPayload}\n`;

  try {
    if (alerterConfig?.output === 'file' && fileHandle) {
      // Append to the already open file handle.
      await fileHandle.appendFile(outputLine, 'utf8');
    } else {
      // Default to stdout if not configured for file or if file handle is invalid.
      process.stdout.write(outputLine);
    }
  } catch (error) {
    // This is a critical path for visibility. If writing the alert fails,
    // we must log it to stderr to ensure it's not lost.
    console.error(`Failed to write alert to '${alerterConfig?.output}':`, error);
    // As a fallback, try writing to stderr so the alert is not completely lost.
    console.error('FALLBACK ALERT:', outputLine);
  }
}

/**
 * Gracefully closes any open resources, such as file handles.
 * This should be called during application shutdown to ensure data is flushed
 * and file descriptors are released.
 *
 * @returns {Promise<void>}
 */
export async function closeAlerter() {
  if (fileHandle) {
    try {
      await fileHandle.close();
      console.log('Alert output file handle closed successfully.');
    } catch (error) {
      console.error('Error closing alert output file handle:', error);
    } finally {
      fileHandle = null;
    }
  }
  alerterConfig = null;
}