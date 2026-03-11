#!/usr/bin/env node

/**
 * @file bin/visualize.js
 * @description A CLI tool to generate and visualize a dungeon in the terminal.
 *
 * This script uses `yargs` to parse command-line arguments and `chalk` to add color
 * to the terminal output, making the dungeon map easy to read. It serves as a
 * powerful debugging and demonstration tool for the procedural dungeon generator library.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { generateDungeon } from '../src/index.js';
import { TILE_TYPES, DEFAULT_CONFIG } from '../src/core/constants.js';

/**
 * Defines the visual representation for each tile type using `chalk`.
 * This mapping allows for easy customization of the terminal output's appearance.
 *
 * @type {Readonly<Record<import('../src/core/constants.js').TileType, string>>}
 */
const TILE_VISUALS = Object.freeze({
  [TILE_TYPES.WALL]: chalk.bgGray.black(' '),
  [TILE_TYPES.FLOOR]: chalk.bgBlackBright.white('.'),
  [TILE_TYPES.DOOR]: chalk.bgYellow.black('+'),
});

/**
 * Renders the generated dungeon grid to the console.
 * Each tile type is mapped to a colored character for clear visualization.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 */
function printDungeon(grid) {
  if (!grid || !Array.isArray(grid) || grid.length === 0) {
    console.error(chalk.red('Cannot print an empty or invalid grid.'));
    return;
  }

  const output = grid
    .map(row =>
      row.map(tile => TILE_VISUALS[tile] ?? TILE_VISUALS[TILE_TYPES.WALL]).join('')
    )
    .join('\n');

  console.log(output);
}

/**
 * Main function to run the CLI tool.
 * It parses arguments, generates a dungeon, and prints it to the console.
 */
async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .usage('Usage: $0 [options]')
      .description('Generate and visualize a procedural dungeon in your terminal.')
      .option('width', {
        alias: 'w',
        type: 'number',
        describe: 'Width of the dungeon grid',
        default: DEFAULT_CONFIG.width,
      })
      .option('height', {
        alias: 'h',
        type: 'number',
        describe: 'Height of the dungeon grid',
        default: DEFAULT_CONFIG.height,
      })
      .option('seed', {
        alias: 's',
        type: 'string', // Allow string seeds for easy memorization
        describe: 'Seed for the random number generator (for reproducibility)',
        default: null,
      })
      .option('bspDepth', {
        alias: 'd',
        type: 'number',
        describe: 'Depth of the BSP tree (controls room count)',
        default: DEFAULT_CONFIG.bspDepth,
      })
      .option('minRoomWidth', {
        type: 'number',
        describe: 'Minimum width of a room',
        default: DEFAULT_CONFIG.minRoomWidth,
      })
      .option('minRoomHeight', {
        type: 'number',
        describe: 'Minimum height of a room',
        default: DEFAULT_CONFIG.minRoomHeight,
      })
      .option('roomPadding', {
        alias: 'p',
        type: 'number',
        describe: 'Padding around rooms',
        default: DEFAULT_CONFIG.roomPadding,
      })
      .help('help')
      .alias('help', '?')
      .version(false) // Disable default version flag
      .example('$0', 'Generate a dungeon with default settings.')
      .example('$0 -w 100 -h 60', 'Generate a larger dungeon.')
      .example('$0 -s "hello world"', 'Generate a dungeon with a specific seed.')
      .epilogue('For more information, check out the project README.')
      .strict() // Report errors for unknown options
      .parse();

    // Construct the configuration object from parsed arguments.
    // Yargs provides defaults, so we don't need to merge with DEFAULT_CONFIG here.
    const config = {
      width: argv.width,
      height: argv.height,
      seed: argv.seed,
      bspDepth: argv.bspDepth,
      minRoomWidth: argv.minRoomWidth,
      minRoomHeight: argv.minRoomHeight,
      roomPadding: argv.roomPadding,
    };

    console.log(chalk.cyan('Generating dungeon with the following configuration:'));
    console.log(chalk.gray(`- Dimensions: ${config.width}x${config.height}`));
    console.log(chalk.gray(`- Seed: ${config.seed ?? 'Random (time-based)'}`));
    console.log(chalk.gray(`- BSP Depth: ${config.bspDepth}`));
    console.log('\n');

    // Generate the dungeon.
    const { grid, rooms, seed: usedSeed } = generateDungeon(config);

    // Print the resulting dungeon to the console.
    printDungeon(grid);

    // Print summary information.
    console.log('\n' + chalk.cyan('Generation complete!'));
    console.log(chalk.green(`✓ Map generated with ${rooms.length} rooms.`));
    // If the initial seed was null, the generator creates one. We show that here.
    if (config.seed === null) {
      console.log(chalk.yellow(`! Used random seed: ${usedSeed} (use '--seed "${usedSeed}"' to reproduce this map)`));
    }
  } catch (error) {
    console.error(chalk.red.bold('\nAn error occurred during dungeon generation:'));
    console.error(chalk.red(error.message));
    // Provide a hint for yargs validation errors
    if (error.name === 'YError') {
      console.error(chalk.yellow('\nTip: Run with --help for a list of available options.'));
    }
    process.exit(1);
  }
}

// Execute the main function when the script is run.
main();