/**
 * @file src/index.js
 * @description Public API entry point for the procedural-dungeon-generator library.
 *
 * This file serves as the main module for the package, exporting the primary
 * `generateDungeon` function and essential constants like `TILE_TYPES`.
 * Consumers of this library will import directly from this file to access
 * its functionality.
 *
 * @example
 * import { generateDungeon, TILE_TYPES } from 'procedural-dungeon-generator';
 *
 * const { grid, rooms } = generateDungeon({
 *   width: 100,
 *   height: 60,
 *   seed: 'my-awesome-game'
 * });
 *
 * console.log('A wall tile is represented by:', TILE_TYPES.WALL);
 */

import { generateDungeon } from './generator.js';
import { TILE_TYPES } from './core/constants.js';

// Export the main generation function as the primary export.
export { generateDungeon };

// Export the tile type constants so consumers can interpret the grid data.
export { TILE_TYPES };

// For convenience, especially for users who might do `import * as Dungeon from '...'`,
// we can also provide a default export object.
export default {
  generateDungeon,
  TILE_TYPES,
};