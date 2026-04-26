/**
 * @file src/transports/index.js
 * @description Factory module for creating and managing log transport instances based on configuration.
 *
 * This module is responsible for dynamically loading and initializing the log
 * transports specified in the application configuration. It acts as a central
 * registry for available transport types and provides a unified interface for
 * creating them. This pluggable architecture makes it easy to add new logging
 * destinations (e.g., file, remote service) in the future without modifying
 * the core logging logic.
 */

import { createConsoleTransport } from './console.js';

/**
 * A map of available transport types to their respective factory functions.
 * This acts as a registry. To add a new transport, import its factory
 * function and add it to this object with a unique key. The key should
 * match the identifier used in the configuration (e.g., 'console').
 *
 * @type {Object.<string, function(object): import('pino').Logger>}
 */
const availableTransports = {
  console: createConsoleTransport,
  // Future transports like 'file' or 'http' would be added here.
  // 'file': createFileTransport,
};

/**
 * Creates and initializes a list of log transport instances based on the
 * provided application configuration.
 *
 * It iterates through the `logTransports` array in the configuration, looks up
 * the corresponding factory function in the `availableTransports` registry,
 * and invokes it with the configuration object to create a transport instance.
 *
 * @param {object} config - The application configuration object.
 * @param {string[]} config.logTransports - An array of strings identifying which transports to create.
 * @returns {import('pino').Logger[]} An array of initialized transport instances (Pino loggers).
 * @throws {Error} If an unknown transport type is requested in the configuration.
 * @throws {Error} If the configuration object is invalid or missing.
 */
export function createTransports(config) {
  if (!config || !Array.isArray(config.logTransports)) {
    throw new Error(
      'Invalid configuration: `logTransports` array is missing or invalid.',
    );
  }

  const transportInstances = [];
  const requestedTransports = config.logTransports;

  for (const transportName of requestedTransports) {
    const createTransport = availableTransports[transportName];

    if (typeof createTransport === 'function') {
      try {
        const transportInstance = createTransport(config);
        transportInstances.push(transportInstance);
      } catch (error) {
        // Log the error but continue, so one failing transport doesn't stop the app.
        // A console.error is used here as the main logger might not be set up yet.
        console.error(
          `[Transport Error] Failed to initialize '${transportName}' transport: ${error.message}`,
        );
        // We could choose to throw here if transports are critical, but robustness is preferred.
      }
    } else {
      // It's important to warn the user about misconfiguration.
      console.warn(
        `[Transport Warning] Unknown log transport '${transportName}' specified in configuration. It will be ignored.`,
      );
    }
  }

  if (transportInstances.length === 0 && requestedTransports.length > 0) {
    // This case can happen if all configured transports failed to initialize.
    // It's a critical state, as no logs would be written.
    throw new Error(
      'No log transports could be initialized based on the current configuration. Logging will not function.',
    );
  }

  return transportInstances;
}