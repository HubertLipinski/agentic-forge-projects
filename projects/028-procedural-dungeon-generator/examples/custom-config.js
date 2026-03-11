/**
 * @file examples/custom-config.js
 * @description An example showing how to generate a dungeon with custom configuration options.
 *
 * This script demonstrates how to override the default settings of the dungeon generator
 * to create a map with specific dimensions, room sizes, and a deterministic seed.
 * Using a seed ensures that the exact same map is generated every time the script is run,
 * which is crucial for testing, debugging, or creating shareable game levels.
 *
 * To run this example, execute `node examples/custom-config.js` from the project root.
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
 * The main function to demonstrate advanced library usage with a custom configuration.
 */
function main() {
  console.log('Generating a dungeon with custom settings and a specific seed...');

  // Define a custom configuration object to override the defaults.
  // This allows for fine-grained control over the generated map.
  const customConfig = {
    width: 100,             // A wider map than the default
    height: 40,             // A shorter map
    minRoomWidth: 6,        // Require slightly larger rooms
    minRoomHeight: 6,
    roomPadding: 3,         // Increase the spacing between rooms
    bspDepth: 5,            // Increase BSP depth for potentially more, smaller rooms (2^5 = 32)
    seed: 'a-very-specific-seed-123', // A string seed for reproducible results
  };

  try {
    // Pass the custom configuration object to the generator.
    const { grid, rooms, seed, config } = generateDungeon(customConfig);

    console.log(`\nSuccessfully generated a ${config.width}x${config.height} dungeon.`);
    console.log(`- Seed provided: "${seed}" (This map is reproducible)`);
    console.log(`- Number of rooms created: ${rooms.length}`);
    console.log('\n--- Dungeon Layout ---');

    // Print the resulting grid to the console.
    printDungeon(grid);

    console.log('\n--- Generation Complete ---');
    console.log('Run this script again, and you will get the exact same map layout.');
    console.log('Try changing the seed to see a different map with the same constraints.');

  } catch (error) {
    // The generator validates the configuration, so it's important to catch potential errors.
    console.error('\nAn error occurred during dungeon generation:');
    console.error(`Error: ${error.message}`);
    console.error('Please check your custom configuration for invalid values.');
    process.exit(1);
  }
}

// Run the main example function.
main();