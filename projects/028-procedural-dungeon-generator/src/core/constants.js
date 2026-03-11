/**
 * @file src/core/constants.js
 * @description Defines shared constants and default configuration values for the dungeon generator.
 *
 * This file centralizes key values used across the generation process, such as tile identifiers
 * and default parameters for the dungeon layout. This makes the system easier to configure,
 * maintain, and understand. Using `Object.freeze` ensures these constants are immutable,
 * preventing accidental modification at runtime.
 */

/**
 * @typedef {0 | 1 | 2} TileType
 * An enumeration of the possible tile types that can make up the dungeon grid.
 * - `WALL` (0): Impassable solid rock.
 * - `FLOOR` (1): Walkable ground, typically inside rooms and corridors.
 * - `DOOR` (2): A special type of floor tile that marks the entrance to a room.
 */

/**
 * An immutable object containing the numerical identifiers for each tile type.
 * Using numbers is memory-efficient for large grids.
 * @type {Readonly<{WALL: 0, FLOOR: 1, DOOR: 2}>}
 */
export const TILE_TYPES = Object.freeze({
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
});

/**
 * An immutable object containing default configuration options for the dungeon generator.
 * These values are used when a user does not provide their own custom configuration,
 * ensuring the generator can always produce a valid map.
 *
 * @property {number} width - The default width of the entire dungeon grid in tiles.
 * @property {number} height - The default height of the entire dungeon grid in tiles.
 * @property {number} minRoomWidth - The default minimum width of a generated room.
 * @property {number} minRoomHeight - The default minimum height of a generated room.
 * @property {number} maxRoomSizeRatio - The default maximum size of a room relative to its BSP container's dimension.
 *   A value of 1.0 means a room can fill its entire container.
 * @property {number} roomPadding - The default minimum empty space (in tiles) to leave around each room.
 *   This prevents rooms from touching directly.
 * @property {number} bspDepth - The default depth of the Binary Space Partitioning tree.
 *   A higher number results in more, smaller rooms.
 * @property {number} bspSplitRatio - The default range for splitting BSP containers. A value of 0.4 means
 *   splits can occur between 40% and 60% of the container's dimension.
 * @property {null} seed - The default seed for the random number generator. A `null` value
 *   results in a time-based (non-deterministic) seed.
 */
export const DEFAULT_CONFIG = Object.freeze({
  // --- Grid Dimensions ---
  width: 80,
  height: 50,

  // --- Room Constraints ---
  minRoomWidth: 5,
  minRoomHeight: 5,
  maxRoomSizeRatio: 0.8, // Rooms can take up to 80% of their container's space
  roomPadding: 2, // 2 tiles of padding around each room

  // --- BSP Algorithm Parameters ---
  bspDepth: 4, // Results in 2^4 = 16 leaf containers
  bspSplitRatio: 0.4, // Split can occur between 40% and 60%

  // --- Reproducibility ---
  seed: null, // Use a time-based seed by default
});