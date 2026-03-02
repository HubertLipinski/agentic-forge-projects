#!/usr/bin/env node

/**
 * @file bin/game.js
 * @description The main executable script for the Terminal Roguelike Engine.
 *
 * This script serves as the entry point for running a game built with the engine.
 * It handles command-line argument parsing, initializes the game world, sets up
 * the core engine components (ECS, renderer, input, etc.), and starts the main
 * game loop. It also provides functionality for loading a saved game state.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { World } from '../src/ecs/index.js';
import { GameLoop } from '../src/core/game-loop.js';
import { Renderer } from '../src/core/renderer.js';
import { InputHandler } from '../src/core/input-handler.js';
import { StateManager } from '../src/core/state-manager.js';
import { MapGenerator } from '../src/map/generator.js';

// --- Helper Functions ---

/**
 * Displays an error message and exits the process.
 * @param {string} message - The error message to display.
 * @param {Error} [error] - The associated error object, if any.
 */
function exitWithError(message, error) {
  console.error(chalk.red.bold('Error:'), message);
  if (error) {
    console.error(chalk.red(error.stack || error.message));
  }
  process.exit(1);
}

/**
 * Dynamically imports the game-specific setup file.
 * This allows the engine to be generic while loading a specific game's
 * components, systems, and initialization logic.
 * @param {string} gamePath - The path to the game's main file.
 * @returns {Promise<object>} The imported game module.
 */
async function loadGameModule(gamePath) {
  try {
    const absolutePath = resolve(process.cwd(), gamePath);
    // Use a dynamic import with a cache-busting query to ensure fresh loading.
    const gameModule = await import(`file://${absolutePath}?v=${Date.now()}`);
    if (typeof gameModule.setupGame !== 'function') {
      throw new Error(`The game file at '${gamePath}' must export a 'setupGame' function.`);
    }
    return gameModule;
  } catch (error) {
    exitWithError(`Failed to load the game module from '${gamePath}'.`, error);
  }
}

/**
 * Creates and initializes a new game world from scratch.
 * @param {object} args - Command-line arguments.
 * @param {Function} setupGame - The game-specific setup function.
 * @returns {Promise<{world: World, playerEntityId: string}>} The initialized world and player ID.
 */
async function createNewGame(args, setupGame) {
  console.log(chalk.cyan('Starting a new game...'));

  const world = new World();
  const stateManager = new StateManager();

  const mapGenerator = new MapGenerator({
    width: args.width,
    height: args.height,
    seed: args.seed,
  });

  const { map, startPosition } = mapGenerator.generate();
  world.map = map;

  // The game-specific setup function is responsible for registering components,
  // creating entities (like the player), and registering systems.
  const { playerEntityId } = await setupGame(world, {
    startPosition,
    rngSeed: args.seed,
  });

  if (!playerEntityId) {
    throw new Error("The 'setupGame' function did not return a playerEntityId.");
  }

  world.stateManager = stateManager;
  return { world, playerEntityId };
}

/**
 * Loads a game world from a saved file.
 * @param {object} args - Command-line arguments.
 * @param {Function} setupGame - The game-specific setup function.
 * @returns {Promise<{world: World, playerEntityId: string}>} The loaded world and player ID.
 */
async function loadSavedGame(args, setupGame) {
  console.log(chalk.cyan(`Loading game from '${args.load}'...`));

  const world = new World();
  const stateManager = new StateManager();
  world.stateManager = stateManager;

  try {
    const savedState = await stateManager.load(args.load);
    const { playerEntityId } = savedState.meta;

    // The game-specific setup function is still needed to register component
    // factories and system instances, which are not part of the saved state.
    await setupGame(world, { isLoad: true });

    // Now, deserialize the saved state into the configured world.
    world.deserialize(savedState.world);

    if (!playerEntityId || !world.entityManager.hasEntity(playerEntityId)) {
      throw new Error('Saved game file is corrupted or missing player data.');
    }

    return { world, playerEntityId };
  } catch (error) {
    exitWithError(`Failed to load the saved game file.`, error);
  }
}

// --- Main Execution ---

/**
 * The main function that initializes and runs the game.
 */
async function main() {
  // --- Argument Parsing ---
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('game', {
      alias: 'g',
      type: 'string',
      description: 'Path to the game setup file.',
      default: 'examples/simple-roguelike/main.js',
    })
    .option('load', {
      alias: 'l',
      type: 'string',
      description: 'Path to a saved game JSON file to load.',
    })
    .option('width', {
      type: 'number',
      description: 'Map width (must be an odd number).',
      default: 79,
    })
    .option('height', {
      type: 'number',
      description: 'Map height (must be an odd number).',
      default: 23,
    })
    .option('seed', {
      type: 'number',
      description: 'Seed for the random number generator.',
      default: Date.now(),
    })
    .help()
    .alias('h', 'help')
    .version(false) // Disable default version, we could add our own from package.json
    .strict()
    .parse();

  // --- Game Initialization ---
  const { setupGame } = await loadGameModule(argv.game);
  let world, playerEntityId;

  if (argv.load) {
    ({ world, playerEntityId } = await loadSavedGame(argv, setupGame));
  } else {
    ({ world, playerEntityId } = await createNewGame(argv, setupGame));
  }

  // --- Engine Setup ---
  const renderer = new Renderer(process.stdout);
  const inputHandler = new InputHandler();
  const gameLoop = new GameLoop({ world, renderer, inputHandler });

  // --- Graceful Exit Handling ---
  const cleanup = () => {
    renderer.cleanup();
    console.log(chalk.yellow('\nGame exited. Goodbye!'));
    process.exit(0);
  };

  process.on('SIGINT', cleanup); // Ctrl+C
  process.on('SIGTERM', cleanup);
  gameLoop.on('stop', cleanup);
  gameLoop.on('gameOver', () => {
    // Keep the process alive for a moment so the user can see the game over message.
    setTimeout(cleanup, 3000);
  });

  // --- Start the Game ---
  try {
    renderer.initialize();
    inputHandler.start();
    await gameLoop.start(playerEntityId);
  } catch (error) {
    renderer.cleanup(); // Ensure terminal state is restored on error
    exitWithError('A critical error occurred during game execution.', error);
  }
}

// Execute the main function.
main().catch(error => {
  // This top-level catch is a final safety net.
  exitWithError('An unexpected error occurred.', error);
});