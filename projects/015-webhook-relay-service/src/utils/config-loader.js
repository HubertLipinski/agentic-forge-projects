/**
 * @fileoverview Loads, validates, and manages the application's routing configuration.
 *
 * This module is responsible for reading the `routes.json` file from the disk,
 * validating its structure against a predefined Ajv schema, and providing access
 * to the configuration. It also implements a "hot-reloading" mechanism by
 * watching the file for changes and automatically reloading and re-validating it
 * without requiring a server restart. This allows for dynamic route updates in a
 * running production environment.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'node:fs';
import Ajv from 'ajv';
import logger from './logger.js';
import routesSchema from '../../config/routes.schema.js';

// --- Constants ---

const CONFIG_FILE_PATH = process.env.ROUTES_CONFIG_PATH ?? path.resolve(process.cwd(), 'config', 'routes.json');
const ajv = new Ajv();
const validate = ajv.compile(routesSchema);

// --- State ---

/**
 * @type {Map<string, object> | null}
 * In-memory cache of the validated routing configuration.
 * The key is the public path (e.g., '/webhooks/github'), and the value is the route object.
 * Initialized to null to indicate it hasn't been loaded yet.
 */
let routeConfig = null;

// --- Private Functions ---

/**
 * Loads and validates the routing configuration from the specified file path.
 *
 * This function performs the following steps:
 * 1. Reads the raw content of the configuration file.
 * 2. Parses the content as JSON.
 * 3. Validates the parsed JSON against the routes schema using Ajv.
 * 4. If valid, transforms the array of routes into a Map for efficient O(1) lookups.
 * 5. Updates the in-memory `routeConfig` state.
 *
 * @private
 * @returns {Promise<void>} A promise that resolves when the configuration is successfully loaded and validated.
 * @throws {Error} If the file cannot be read, is not valid JSON, or fails schema validation.
 */
async function loadAndValidateConfig() {
  logger.info({ path: CONFIG_FILE_PATH }, 'Attempting to load and validate route configuration...');

  let fileContent;
  try {
    fileContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  } catch (error) {
    logger.error({ path: CONFIG_FILE_PATH, error: error.message }, 'Failed to read configuration file.');
    // If the file doesn't exist on initial load, we can't start.
    // If it's a reload, we keep the old config, so we don't throw here.
    if (routeConfig === null) {
      throw new Error(`Configuration file not found at ${CONFIG_FILE_PATH}. The service cannot start.`);
    }
    return; // Keep using the old valid config on reload failure
  }

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(fileContent);
  } catch (error) {
    logger.error({ path: CONFIG_FILE_PATH, error: error.message }, 'Failed to parse configuration file. Invalid JSON.');
    if (routeConfig === null) {
      throw new Error('Initial configuration is not valid JSON. The service cannot start.');
    }
    return; // Keep using the old valid config
  }

  if (!validate(parsedConfig)) {
    logger.error({
      path: CONFIG_FILE_PATH,
      errors: validate.errors,
    }, 'Configuration file failed schema validation.');
    if (routeConfig === null) {
      const errorDetails = ajv.errorsText(validate.errors);
      throw new Error(`Initial configuration is invalid: ${errorDetails}. The service cannot start.`);
    }
    return; // Keep using the old valid config
  }

  // Transform the array into a Map for efficient path-based lookups.
  const newConfigMap = new Map(
    parsedConfig.routes.map(route => [route.path, route])
  );

  routeConfig = newConfigMap;
  logger.info({ path: CONFIG_FILE_PATH, routeCount: routeConfig.size }, 'Successfully loaded and validated new route configuration.');
}

/**
 * Sets up a file watcher to automatically reload the configuration when it changes.
 * This enables "hot-reloading" of routes without a server restart.
 *
 * It uses a simple debounce mechanism to prevent multiple rapid reloads if the
 * file is saved multiple times in quick succession.
 *
 * @private
 */
function watchConfigFile() {
  try {
    const watcher = watch(CONFIG_FILE_PATH, { persistent: false });
    let debounceTimer = null;

    watcher.on('change', (eventType) => {
      if (eventType === 'change') {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          logger.info({ path: CONFIG_FILE_PATH }, 'Configuration file changed. Triggering reload.');
          loadAndValidateConfig().catch(error => {
            // Log the error but don't crash the server. The old config will be used.
            logger.error({ error: error.message }, 'Error during configuration hot-reload. The previous valid configuration will remain active.');
          });
        }, 250); // 250ms debounce window
      }
    });

    watcher.on('error', (error) => {
      logger.error({ path: CONFIG_FILE_PATH, error: error.message }, 'Error watching configuration file.');
    });

    logger.info({ path: CONFIG_FILE_PATH }, 'Started watching configuration file for changes.');
  } catch (error) {
    logger.warn({ path: CONFIG_FILE_PATH, error: error.message }, 'Could not start watching configuration file. Hot-reloading will be disabled.');
  }
}

// --- Public API ---

/**
 * Initializes the configuration by performing an initial load and setting up the file watcher.
 * This must be called once at application startup.
 *
 * @returns {Promise<void>} A promise that resolves when the initial configuration is loaded.
 */
export async function initializeConfig() {
  await loadAndValidateConfig();
  watchConfigFile();
}

/**
 * Retrieves the current, validated routing configuration.
 *
 * @returns {Map<string, object>} The current route configuration map.
 * @throws {Error} If the configuration has not been loaded yet.
 */
export function getConfig() {
  if (routeConfig === null) {
    // This should not happen in a correctly initialized application.
    throw new Error('Configuration has not been initialized. Call initializeConfig() first.');
  }
  // Return a deep copy to prevent accidental mutation of the in-memory state.
  return structuredClone(routeConfig);
}

/**
 * Retrieves the configuration for a specific route path.
 *
 * @param {string} path The public path of the route to look up (e.g., '/webhooks/github').
 * @returns {object | undefined} The route configuration object if found, otherwise undefined.
 */
export function getRouteByPath(path) {
  if (routeConfig === null) {
    logger.warn('Attempted to get route before configuration was initialized.');
    return undefined;
  }
  return routeConfig.get(path);
}