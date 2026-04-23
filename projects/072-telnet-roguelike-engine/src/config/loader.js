/**
 * @file src/config/loader.js
 * @description Provides utilities for loading and validating game configuration data from JSON files.
 * This module is crucial for allowing game designers to define game content like monsters,
 * items, and rules in an external, easy-to-edit format.
 */

import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * A generic function to load and parse a JSON file from a given path.
 * It includes robust error handling for file access and JSON parsing.
 *
 * @param {string} filePath - The absolute path to the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON object.
 * @throws {Error} If the file cannot be read or if the content is not valid JSON.
 */
async function loadJsonFile(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`[ConfigLoader] Configuration file not found: ${filePath}`);
            throw new Error(`Configuration file not found: ${filePath}`);
        }
        if (error instanceof SyntaxError) {
            logger.error(`[ConfigLoader] Failed to parse JSON in file: ${filePath}. Error: ${error.message}`);
            throw new Error(`Invalid JSON format in ${filePath}`);
        }
        logger.error(`[ConfigLoader] Error reading file: ${filePath}. Error: ${error.message}`);
        throw error; // Re-throw other unexpected errors
    }
}

/**
 * Loads all configuration files of a specific type (e.g., 'monsters', 'items')
 * from a given game directory. It assumes a structure like `games/<gameName>/config/<configType>.json`.
 *
 * This function provides a structured way to access game-specific data, making the engine
 * adaptable to different game "mods" or definitions.
 *
 * @param {string} gameName - The name of the game directory (e.g., 'default').
 * @param {string} configType - The type of configuration to load (e.g., 'monsters'). This corresponds to the filename.
 * @returns {Promise<object>} A promise that resolves with the configuration object from the file.
 *                            Returns an empty object and logs a warning if the file is not found.
 *
 * @example
 * // To load `games/default/config/monsters.json`:
 * const monsterConfig = await loadConfig('default', 'monsters');
 */
export async function loadConfig(gameName, configType) {
    // Construct the path relative to the project root.
    // `process.cwd()` gives the directory where the Node.js process was started.
    const filePath = path.join(process.cwd(), 'games', gameName, 'config', `${configType}.json`);

    logger.info(`[ConfigLoader] Loading '${configType}' config for game '${gameName}' from: ${filePath}`);

    try {
        const configData = await loadJsonFile(filePath);
        logger.info(`[ConfigLoader] Successfully loaded '${configType}' configuration.`);
        return configData;
    } catch (error) {
        // If the file simply doesn't exist, it might not be an error (e.g., a game without items).
        // We log a warning and return an empty object to prevent crashes.
        if (error.message.includes('not found')) {
            logger.warn(`[ConfigLoader] Optional config file '${configType}.json' not found for game '${gameName}'. Proceeding without it.`);
            return {};
        }
        // For other errors (parsing, permissions), we re-throw to halt execution,
        // as this likely indicates a critical setup problem.
        throw error;
    }
}

/**
 * Loads multiple configuration types for a given game.
 * This is a convenience function to load all necessary data in one call.
 *
 * @param {string} gameName - The name of the game directory.
 * @param {string[]} configTypes - An array of configuration types to load (e.g., ['monsters', 'items', 'rules']).
 * @returns {Promise<Object<string, object>>} A promise that resolves to an object where keys are the
 *                                             config types and values are their corresponding loaded data.
 *
 * @example
 * const allConfigs = await loadAllConfigs('default', ['monsters', 'items']);
 * // allConfigs might look like:
 * // {
 * //   monsters: { goblin: { ... }, orc: { ... } },
 * //   items: { health_potion: { ... } }
 * // }
 */
export async function loadAllConfigs(gameName, configTypes) {
    const loadedConfigs = {};
    const loadPromises = configTypes.map(async (type) => {
        const data = await loadConfig(gameName, type);
        if (Object.keys(data).length > 0) {
            loadedConfigs[type] = data;
        }
    });

    // `Promise.all` ensures all files are loaded in parallel for efficiency.
    await Promise.all(loadPromises);

    return loadedConfigs;
}

/**
 * Validates a loaded configuration object against a predefined schema or set of rules.
 * This is a placeholder for a more complex validation logic (e.g., using a library like Zod or Ajv).
 * For now, it performs a basic check to ensure the loaded data is a non-empty object.
 *
 * @param {object} configData - The configuration data to validate.
 * @param {string} configType - The type of configuration being validated, used for logging.
 * @returns {boolean} True if the configuration is valid, false otherwise.
 */
export function validateConfig(configData, configType) {
    if (typeof configData !== 'object' || configData === null || Array.isArray(configData)) {
        logger.error(`[ConfigLoader] Validation failed for '${configType}': Expected a non-null object.`);
        return false;
    }

    if (Object.keys(configData).length === 0) {
        // An empty config file is not an error, but it's worth noting.
        logger.warn(`[ConfigLoader] Validation notice for '${configType}': Configuration is empty.`);
    }

    // TODO: Implement more specific, schema-based validation for each config type.
    // For example, check that all monsters have 'name', 'renderable', and 'combatStats' properties.

    return true;
}