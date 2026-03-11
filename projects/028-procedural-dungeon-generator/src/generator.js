/**
 * @file src/generator.js
 * @description The main dungeon generation orchestrator.
 *
 * This module brings together all the core components of the generation process.
 * It initializes the configuration, runs the Binary Space Partitioning (BSP) algorithm
 * to create a layout of containers, places rooms within those containers, carves the
 * rooms into the grid, and finally connects them with corridors. The final output is
 * a 2D array representing the complete, explorable dungeon map.
 */

import { RNG } from '../utils/rng.js';
import { Rectangle } from '../utils/geometry.js';
import { TILE_TYPES, DEFAULT_CONFIG } from './core/constants.js';
import { performBsp } from './core/bsp.js';
import { connectRooms } from './core/corridors.js';

/**
 * Validates and merges user-provided configuration with default values.
 * Throws an error if the configuration contains invalid values.
 *
 * @private
 * @param {object} [userConfig={}] - The user-provided configuration object.
 * @returns {object} A complete, validated configuration object.
 * @throws {Error} If any configuration value is invalid.
 */
function processConfig(userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // --- Type and Range Validations ---
  const positiveIntegers = ['width', 'height', 'minRoomWidth', 'minRoomHeight', 'roomPadding', 'bspDepth'];
  for (const key of positiveIntegers) {
    if (!Number.isInteger(config[key]) || config[key] <= 0) {
      throw new Error(`Config error: '${key}' must be a positive integer. Received: ${config[key]}`);
    }
  }

  const ratios = ['maxRoomSizeRatio', 'bspSplitRatio'];
  for (const key of ratios) {
    if (typeof config[key] !== 'number' || config[key] <= 0 || config[key] >= 1) {
      throw new Error(`Config error: '${key}' must be a number between 0 and 1 (exclusive). Received: ${config[key]}`);
    }
  }

  // --- Logical Validations ---
  if (config.minRoomWidth < 3 || config.minRoomHeight < 3) {
    throw new Error('Config error: `minRoomWidth` and `minRoomHeight` must be at least 3 to ensure rooms have an interior.');
  }

  if (config.minRoomWidth + 2 * config.roomPadding > config.width || config.minRoomHeight + 2 * config.roomPadding > config.height) {
    throw new Error('Config error: Minimum room size plus padding cannot exceed the total dungeon dimensions.');
  }

  return config;
}

/**
 * Initializes a 2D grid of a given width and height, filled with a specified tile type.
 *
 * @private
 * @param {number} width - The width of the grid.
 * @param {number} height - The height of the grid.
 * @param {import('./core/constants.js').TileType} fillTile - The tile type to fill the grid with.
 * @returns {number[][]} The newly created 2D grid.
 */
function createGrid(width, height, fillTile) {
  // `Array.fill` creates references to the same array, so we must use a map-based approach.
  return Array.from({ length: height }, () => Array(width).fill(fillTile));
}

/**
 * Places a randomly sized room within each leaf container from the BSP process.
 * The room's size is constrained by the container's dimensions and the generator's configuration.
 *
 * @private
 * @param {import('./core/bsp.js').BspNode[]} leafNodes - The array of leaf nodes from the BSP tree.
 * @param {object} config - The validated dungeon configuration.
 * @param {RNG} rng - The seeded random number generator.
 */
function placeRoomsInLeaves(leafNodes, config, rng) {
  const { minRoomWidth, minRoomHeight, maxRoomSizeRatio, roomPadding } = config;

  for (const leaf of leafNodes) {
    // Create a padded area within the container to place the room.
    const paddedContainer = leaf.container.shrink(roomPadding);

    if (paddedContainer.width < minRoomWidth || paddedContainer.height < minRoomHeight) {
      // This container is too small to hold a valid room after padding.
      // This can happen with certain configurations (e.g., high bspDepth, large padding).
      // We simply skip creating a room here, resulting in more empty space.
      continue;
    }

    // Determine the maximum possible size for the room within the padded container.
    const maxRoomW = Math.floor(paddedContainer.width * maxRoomSizeRatio);
    const maxRoomH = Math.floor(paddedContainer.height * maxRoomSizeRatio);

    // Ensure the calculated max size is not smaller than the minimum required size.
    const finalMaxW = Math.max(minRoomWidth, maxRoomW);
    const finalMaxH = Math.max(minRoomHeight, maxRoomH);

    // Generate a random room size.
    const roomWidth = rng.nextIntInclusive(minRoomWidth, finalMaxW);
    const roomHeight = rng.nextIntInclusive(minRoomHeight, finalMaxH);

    // Randomly position the room within the padded container.
    const roomX = rng.nextIntInclusive(paddedContainer.left, paddedContainer.right - roomWidth);
    const roomY = rng.nextIntInclusive(paddedContainer.top, paddedContainer.bottom - roomHeight);

    leaf.room = new Rectangle(roomX, roomY, roomWidth, roomHeight);
  }
}

/**
 * Carves the generated rooms and doors into the dungeon grid.
 *
 * @private
 * @param {number[][]} grid - The 2D grid to modify.
 * @param {import('./core/bsp.js').BspNode[]} leafNodes - The leaf nodes containing the rooms to carve.
 */
function carveRooms(grid, leafNodes) {
  for (const leaf of leafNodes) {
    if (!leaf.room) continue;

    const { left, right, top, bottom } = leaf.room;

    // Carve the floor of the room.
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        // Check bounds as a safeguard.
        if (grid[y]?.[x] !== undefined) {
          grid[y][x] = TILE_TYPES.FLOOR;
        }
      }
    }
  }
}

/**
 * The main dungeon generation function. It orchestrates the entire process from
 * configuration to final grid creation.
 *
 * @param {object} [userConfig] - A configuration object to override the default settings.
 * @property {number} [userConfig.width=80] - The width of the dungeon grid.
 * @property {number} [userConfig.height=50] - The height of the dungeon grid.
 * @property {number} [userConfig.minRoomWidth=5] - The minimum width of a room.
 * @property {number} [userConfig.minRoomHeight=5] - The minimum height of a room.
 * @property {number} [userConfig.maxRoomSizeRatio=0.8] - Max room size relative to its container.
 * @property {number} [userConfig.roomPadding=2] - Empty space around each room.
 * @property {number} [userConfig.bspDepth=4] - The depth of the BSP tree.
 * @property {number} [userConfig.bspSplitRatio=0.4] - The range for splitting BSP containers.
 * @property {number|string|null} [userConfig.seed=null] - The seed for the RNG. `null` for a time-based seed.
 * @returns {{grid: number[][], rooms: Rectangle[], seed: number|string|null, config: object}} An object containing the generated grid, an array of room rectangles, the seed used, and the final configuration.
 * @throws {Error} If the provided configuration is invalid.
 */
export function generateDungeon(userConfig) {
  // 1. Configuration & Initialization
  const config = processConfig(userConfig);
  const rng = new RNG(config.seed);

  // 2. Create the initial grid filled with walls.
  const grid = createGrid(config.width, config.height, TILE_TYPES.WALL);

  // 3. Perform Binary Space Partitioning to get leaf containers.
  const leafNodes = performBsp(config, rng);

  // 4. Place rooms within the leaf containers.
  placeRoomsInLeaves(leafNodes, config, rng);

  // 5. Carve the rooms into the grid.
  carveRooms(grid, leafNodes);

  // 6. Connect the rooms with corridors.
  connectRooms(grid, leafNodes, rng);

  // 7. Collect final room data for the return object.
  const rooms = leafNodes.filter(leaf => leaf.room).map(leaf => leaf.room);

  return {
    grid,
    rooms,
    seed: config.seed, // Return the original seed for reproducibility reference
    config,
  };
}