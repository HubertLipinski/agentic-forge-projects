/**
 * @file src/ui/spinner.js
 * @description A wrapper around the `ora` library to provide a consistent
 * progress indication spinner during test runs. This module centralizes
 * spinner creation and management, making it easy to display and update
 * progress information throughout the application.
 */

import ora from 'ora';
import chalk from 'chalk';

/**
 * A singleton instance of the ora spinner. This ensures that only one
 * spinner is active at any given time, preventing interleaved or
 * conflicting console output.
 * @type {import('ora').Ora | null}
 */
let spinnerInstance = null;

/**
 * Creates and starts a new progress spinner, or updates the text of an
 * existing one. This function ensures that only one spinner instance is
 * active at a time.
 *
 * @param {string} text - The initial text to display next to the spinner.
 * @returns {import('ora').Ora} The active ora instance.
 */
export function startSpinner(text) {
  if (spinnerInstance) {
    // If a spinner is already running, just update its text.
    spinnerInstance.text = text;
    return spinnerInstance;
  }

  // Create a new spinner instance if one doesn't exist.
  spinnerInstance = ora({
    text,
    spinner: 'dots', // A clean, simple spinner style.
    color: 'cyan',
  }).start();

  return spinnerInstance;
}

/**
 * Updates the text of the active spinner, typically to reflect progress.
 * For example, updating the count of completed runs.
 *
 * @param {string} text - The new text to display.
 */
export function updateSpinnerText(text) {
  if (spinnerInstance) {
    spinnerInstance.text = text;
  }
}

/**
 * Stops the active spinner and displays a final message with a success symbol.
 *
 * @param {string} text - The final message to display.
 */
export function succeedSpinner(text) {
  if (spinnerInstance) {
    spinnerInstance.succeed(chalk.green.bold(text));
    spinnerInstance = null; // Reset the instance so a new one can be created.
  }
}

/**
 * Stops the active spinner and displays a final message with a failure symbol.
 *
 * @param {string} text - The final message to display.
 */
export function failSpinner(text) {
  if (spinnerInstance) {
    spinnerInstance.fail(chalk.red.bold(text));
    spinnerInstance = null; // Reset the instance.
  }
}

/**
 * Stops the active spinner and displays a final message with a warning symbol.
 *
 * @param {string} text - The final message to display.
 */
export function warnSpinner(text) {
  if (spinnerInstance) {
    spinnerInstance.warn(chalk.yellow.bold(text));
    spinnerInstance = null; // Reset the instance.
  }
}

/**
 * Stops the spinner without printing any final message or symbol.
 * This is useful for cleanly ending the spinner before printing other output,
 * like a final report.
 */
export function stopSpinner() {
  if (spinnerInstance) {
    spinnerInstance.stop();
    spinnerInstance = null;
  }
}