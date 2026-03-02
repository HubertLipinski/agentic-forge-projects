/**
 * @file src/core/state-manager.js
 * @description Handles saving and loading the entire game state (ECS world, map) to and from a JSON file.
 *
 * This module provides functions to serialize the current game state into a JSON
 * format and save it to a file, and to load such a file and deserialize it back
 * into a live game state. This is essential for features like saving progress
 * and resuming a game session.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Tile } from '../map/tile.js';

/**
 * A container for the entire serializable game state.
 * This object structure defines what gets written to the save file.
 */
class GameState {
  /**
   * @param {object} world - The ECS world object.
   * @param {import('../map/tile.js').Tile[][]} gameMap - The 2D array representing the game map.
   */
  constructor(world, gameMap) {
    /**
     * The serialized state of the Entity-Component-System world.
     * @type {object}
     */
    this.ecs = world.serialize();

    /**
     * The serialized state of the game map.
     * @type {object[][]}
     */
    this.map = gameMap.map(row => row.map(tile => tile.serialize()));
  }

  /**
   * Converts the game state to a JSON string.
   * @returns {string} A JSON string representation of the game state.
   */
  toJSON() {
    // Using a replacer function to handle any complex types if needed in the future,
    // and `2` for indentation to make the save file human-readable for debugging.
    return JSON.stringify(this, null, 2);
  }

  /**
   * Creates a GameState instance from a parsed JSON object.
   * @param {object} parsedJSON - The raw object parsed from a JSON save file.
   * @returns {GameState} A new GameState instance.
   */
  static fromJSON(parsedJSON) {
    const state = new GameState({ serialize: () => ({}) }, []); // Create a dummy instance
    state.ecs = parsedJSON.ecs;
    state.map = parsedJSON.map;
    return state;
  }
}

/**
 * Saves the current game state to a specified file path.
 * The function serializes the world and map, then writes the resulting JSON to disk.
 *
 * @param {string} filePath - The path to the save file (e.g., './savegame.json').
 * @param {object} world - The main ECS world object to be saved.
 * @param {import('../map/tile.js').Tile[][]} gameMap - The current game map to be saved.
 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
 * @throws {Error} If saving fails due to I/O errors or serialization issues.
 */
export async function saveGame(filePath, world, gameMap) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('A valid file path must be provided to save the game.');
  }
  if (!world || typeof world.serialize !== 'function') {
    throw new Error('A valid world object with a serialize method must be provided.');
  }
  if (!Array.isArray(gameMap)) {
    throw new Error('A valid game map array must be provided.');
  }

  try {
    console.log(`Serializing game state...`);
    const gameState = new GameState(world, gameMap);
    const jsonString = gameState.toJSON();

    // Ensure the directory exists before writing the file.
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    console.log(`Saving game to ${filePath}...`);
    await fs.writeFile(filePath, jsonString, 'utf-8');
    console.log('Game saved successfully.');
  } catch (error) {
    console.error(`[StateManager] Failed to save game: ${error.message}`);
    // Re-throw the error so the caller can handle it, e.g., by notifying the user.
    throw new Error(`Could not save game to "${filePath}". Reason: ${error.message}`);
  }
}

/**
 * Loads a game state from a specified file path.
 * The function reads the JSON file, parses it, and deserializes the data
 * back into the provided world and a new map object.
 *
 * @param {string} filePath - The path to the save file to load.
 * @param {object} world - The main ECS world object to load the state into.
 * @returns {Promise<{gameMap: import('../map/tile.js').Tile[][]}>} A promise that resolves with an object containing the loaded game map.
 * @throws {Error} If loading fails due to file not found, I/O errors, or parsing/deserialization issues.
 */
export async function loadGame(filePath, world) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('A valid file path must be provided to load the game.');
  }
  if (!world || typeof world.deserialize !== 'function') {
    throw new Error('A valid world object with a deserialize method must be provided.');
  }

  try {
    console.log(`Loading game from ${filePath}...`);
    const jsonString = await fs.readFile(filePath, 'utf-8');
    const parsedJSON = JSON.parse(jsonString);

    if (!parsedJSON.ecs || !parsedJSON.map) {
      throw new Error('Save file is corrupted or has an invalid format.');
    }

    console.log('Deserializing game state...');
    const gameState = GameState.fromJSON(parsedJSON);

    // Deserialize the ECS world state. This will repopulate the entity,
    // component, and system managers.
    world.deserialize(gameState.ecs);

    // Deserialize the map state by creating new Tile instances from the raw data.
    const gameMap = gameState.map.map(row =>
      row.map(tileData => Tile.deserialize(tileData))
    );

    console.log('Game loaded successfully.');
    return { gameMap };
  } catch (error) {
    console.error(`[StateManager] Failed to load game: ${error.message}`);
    // Provide a more user-friendly error message depending on the error type.
    if (error.code === 'ENOENT') {
      throw new Error(`Save file not found at "${filePath}".`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse save file "${filePath}". It may be corrupted.`);
    }
    // Re-throw other errors for the caller to handle.
    throw new Error(`Could not load game from "${filePath}". Reason: ${error.message}`);
  }
}