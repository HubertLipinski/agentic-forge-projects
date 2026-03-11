/**
 * @file examples/basic-usage.js
 * @description A simple example demonstrating how to generate a dungeon with default settings.
 *
 * This script imports the `generateDungeon` function and `TILE_TYPES` constants
 * from the library, generates a map, and then prints a basic text-based
 * representation of it to the console. It showcases the simplest possible
 * integration of the library.
 *
 * To run this example, execute `node examples/basic-usage.js` from the project root.
 */

import { generateDungeon, TILE_TYPES } from '../src/index.js';

/**
 * A simple mapping of tile types to characters for console visualization.
 * This helps in understanding the structure of the generated grid data.
 * @type {Readonly<Record<number, string>>}
 */
const TILE_CHARACTERS = Object.freeze({
  [TILE_TYPES.WALL]: '#', // A solid character for walls
  [TILE_TYPES.FLOOR]: '.', // A dot for walkable floor space
  [TILE_TYPES.DOOR]: '+', // A plus sign to indicate a door
});

/**
 * Renders the generated dungeon grid to the console using simple ASCII characters.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 */
function printDungeon(grid) {
  if (!grid || !Array.isArray(grid) || grid.length === 0) {
    console.error('Cannot print an empty or invalid grid.');
    return;
  }

  // Convert each row of tile numbers into a string of characters.
  const output = grid
    .map(row =>
      row.map(tileId => TILE_CHARACTERS[tileId] ?? TILE_CHARACTERS[TILE_TYPES.WALL]).join('')
    )
    .join('\n');

  console.log(output);
}

/**
 * The main function to demonstrate basic library usage.
 */
function main() {
  console.log('Generating a new dungeon with default settings...');

  try {
    // Call the main generation function without any configuration.
    // The library will use its internal default values.
    const { grid, rooms, seed, config } = generateDungeon();

    console.log(`\nSuccessfully generated a ${config.width}x${config.height} dungeon.`);
    console.log(`- Seed used for this generation: ${seed}`);
    console.log(`- Number of rooms created: ${rooms.length}`);
    console.log('\n--- Dungeon Layout ---');

    // Print the resulting grid to the console.
    printDungeon(grid);

    console.log('\n--- Generation Complete ---');
    console.log('To generate this exact same map again, use the seed provided above.');
    console.log('Try running `node examples/custom-config.js` to see how to use a seed.');

  } catch (error) {
    // Although unlikely with default settings, it's good practice to handle potential errors.
    console.error('\nAn unexpected error occurred during dungeon generation:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the main example function.
main();