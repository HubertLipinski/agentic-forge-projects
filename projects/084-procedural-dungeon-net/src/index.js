/**
 * @file src/index.js
 * @description Main application entry point. Parses CLI arguments and starts the server and game engine.
 * This script orchestrates the initialization of the entire application, including:
 * - Parsing command-line arguments for configuration (port, save file, etc.).
 * - Loading a saved world state or generating a new one.
 * - Starting the TCP server to listen for client connections.
 * - Initializing and starting the main game loop (engine).
 * - Handling graceful shutdown on signals like SIGINT.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { fileURLToPath } from 'url';

import { DungeonGenerator } from './world/dungeon-generator.js';
import { DungeonMap } from './world/map.js';
import { WorldState } from './state/world-state.js';
import { StatePersister } from './state/state-persister.js';
import { Server } from './network/server.js';
import { GameEngine } from './game/engine.js';
import { EventBus } from './game/event-bus.js';
import { Npc } from './entities/npc.js'; // Needed for populating the world

// --- Configuration & Constants ---

const DEFAULT_PORT = 4000;
const DEFAULT_SAVE_INTERVAL = 300000; // 5 minutes
const DEFAULT_TICK_RATE = 100; // 10 ticks per second
const DEFAULT_DUNGEON_WIDTH = 80;
const DEFAULT_DUNGEON_HEIGHT = 50;
const DEFAULT_NPC_COUNT = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SAVE_PATH = path.resolve(__dirname, '../../saves/world.json');

/**
 * Parses command-line arguments using yargs.
 * @returns {object} The parsed arguments object.
 */
function parseArguments() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Port to run the TCP server on',
      default: DEFAULT_PORT,
    })
    .option('save-file', {
      alias: 's',
      type: 'string',
      description: 'Path to the world state save file',
      default: DEFAULT_SAVE_PATH,
    })
    .option('no-persist', {
      type: 'boolean',
      description: 'Disable loading from and saving to the save file',
      default: false,
    })
    .option('save-interval', {
      type: 'number',
      description: 'Interval in ms to automatically save the world state',
      default: DEFAULT_SAVE_INTERVAL,
    })
    .option('seed', {
      type: 'number',
      description: 'Seed for the random number generator for dungeon creation. If not provided, uses current timestamp.',
      default: Date.now(),
    })
    .option('width', {
      type: 'number',
      description: 'Width of the generated dungeon',
      default: DEFAULT_DUNGEON_WIDTH,
    })
    .option('height', {
      type: 'number',
      description: 'Height of the generated dungeon',
      default: DEFAULT_DUNGEON_HEIGHT,
    })
    .option('npcs', {
        type: 'number',
        description: 'Number of NPCs to spawn in a new world',
        default: DEFAULT_NPC_COUNT,
    })
    .help()
    .alias('help', 'h')
    .version(false) // Custom version logging
    .argv;
}

/**
 * Generates a new world from scratch.
 * @param {object} config - Configuration options.
 * @param {number} config.seed - The seed for the dungeon generator.
 * @param {number} config.width - The width of the dungeon.
 * @param {number} config.height - The height of the dungeon.
 * @param {number} config.npcs - The number of NPCs to create.
 * @param {EventBus} eventBus - The global event bus.
 * @returns {WorldState} A newly created WorldState instance.
 */
function generateNewWorld({ seed, width, height, npcs }, eventBus) {
  console.log(`Generating new world with seed: ${seed}`);
  const generator = new DungeonGenerator({ width, height, seed });
  const mapData = generator.generate();
  const dungeonMap = new DungeonMap(mapData);

  const worldState = new WorldState(dungeonMap, eventBus, DEFAULT_TICK_RATE);

  // Populate the world with some NPCs
  console.log(`Spawning ${npcs} NPCs...`);
  for (let i = 0; i < npcs; i++) {
    const pos = dungeonMap.getRandomWalkableTile();
    if (pos) {
      const npc = new Npc({
        name: `Goblin #${i + 1}`,
        x: pos.x,
        y: pos.y,
      });
      worldState.addActor(npc);
    }
  }

  return worldState;
}

/**
 * The main asynchronous function to start the application.
 */
async function main() {
  const args = parseArguments();
  console.log('Starting Procedural Dungeon Net...');
  console.log(`Server port: ${args.port}`);
  console.log(`Persistence: ${args.noPersist ? 'DISABLED' : `ENABLED (file: ${args.saveFile})`}`);

  const eventBus = new EventBus();
  const persister = new StatePersister(args.saveFile);

  let worldState;

  if (!args.noPersist) {
    try {
      const loadedData = await persister.load();
      if (loadedData) {
        console.log('Successfully loaded world state from disk.');
        worldState = WorldState.deserialize(loadedData, eventBus, DEFAULT_TICK_RATE);
      }
    } catch (error) {
      console.warn(`Could not load save file: ${error.message}. A new world will be generated.`);
    }
  }

  if (!worldState) {
    worldState = generateNewWorld(args, eventBus);
  }

  const server = new Server(args.port, worldState, eventBus);
  const engine = new GameEngine(worldState, eventBus, persister, {
    noPersist: args.noPersist,
    saveInterval: args.saveInterval,
    tickRate: DEFAULT_TICK_RATE,
  });

  try {
    await server.start();
    engine.start();
  } catch (error) {
    console.error('Failed to start server or engine:', error);
    process.exit(1);
  }

  /**
   * Handles graceful shutdown of the server and game engine.
   */
  async function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Shutting down gracefully...');

    try {
      // 1. Stop the game engine to prevent further state changes
      engine.stop();

      // 2. Stop the server from accepting new connections
      await server.stop();

      // 3. Save the final world state
      if (!args.noPersist) {
        await persister.save(worldState.serialize());
        console.log('Final world state saved.');
      }
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    }

    console.log('Shutdown complete.');
    process.exit(0);
  }

  // Listen for shutdown signals
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// Execute the main function
main().catch(error => {
  console.error('An unhandled error occurred during application startup:', error);
  process.exit(1);
});