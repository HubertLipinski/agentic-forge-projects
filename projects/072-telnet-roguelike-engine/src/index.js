/**
 * @file src/index.js
 * @description Main entry point for the Telnet Roguelike Engine.
 * This script initializes and starts the Telnet server and the main game instance.
 * It serves as the primary executable for running the game server.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import TelnetServer from './net/telnet-server.js';
import GameInstance from './game/game-instance.js';
import logger from './utils/logger.js';

/**
 * The main asynchronous function that sets up and runs the entire application.
 * It parses command-line arguments, initializes the game instance, starts the
 * Telnet server, and wires them together.
 *
 * @returns {Promise<void>} A promise that resolves when the server is running, or rejects on a fatal error.
 */
async function main() {
    // __dirname is not available in ES modules, so we derive it.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const argv = yargs(hideBin(process.argv))
        .option('port', {
            alias: 'p',
            type: 'number',
            description: 'Port to run the Telnet server on',
            default: 2323,
        })
        .option('game', {
            alias: 'g',
            type: 'string',
            description: 'Path to the game directory',
            default: 'default',
        })
        .option('log-level', {
            alias: 'l',
            type: 'string',
            description: 'Set the logging level (error, warn, info, debug)',
            default: process.env.LOG_LEVEL || 'info',
            choices: ['error', 'warn', 'info', 'debug'],
        })
        .help()
        .alias('help', 'h')
        .version()
        .alias('version', 'v')
        .parse();

    // Set the logger level based on the command-line argument.
    logger.setLevel(argv.logLevel);

    logger.info('--- Telnet Roguelike Engine ---');
    logger.info(`Starting server with log level: ${argv.logLevel.toUpperCase()}`);

    try {
        // Resolve the full path to the game directory.
        // This allows using relative paths from the project root or absolute paths.
        const gameDirectory = path.resolve(process.cwd(), 'games', argv.game);
        logger.info(`Loading game from: ${gameDirectory}`);

        // 1. Initialize the Game Instance
        // The GameInstance manages the ECS world, game loop, and map generation.
        const gameInstance = new GameInstance({ gameDirectory });
        await gameInstance.initialize();

        // 2. Initialize the Telnet Server
        // The TelnetServer handles raw network connections and client management.
        const server = new TelnetServer({
            port: argv.port,
            host: '0.0.0.0', // Listen on all available network interfaces
        });

        // 3. Wire the Server and Game Instance together
        // When a new client connects, the game instance creates a player entity for them.
        server.on('client-connected', (client) => {
            logger.info(`Client connected from ${client.remoteAddress}`);
            gameInstance.onPlayerConnected(client);
        });

        // When a client disconnects, the game instance cleans up their entity.
        server.on('client-disconnected', (client) => {
            logger.info(`Client disconnected from ${client.remoteAddress}`);
            gameInstance.onPlayerDisconnected(client);
        });

        // When a client sends data, it's passed to the game instance for input processing.
        server.on('client-data', (client, data) => {
            gameInstance.onPlayerInput(client, data);
        });

        // 4. Start the server and the game loop
        await server.start();
        gameInstance.start();

        logger.info(`Server is listening on port ${argv.port}`);
        logger.info('Ready for players to connect!');

    } catch (error) {
        logger.error('A fatal error occurred during initialization:');
        logger.error(error.stack || error.message);
        process.exit(1);
    }
}

// Graceful shutdown handling
const handleShutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    // In a real-world scenario, you might want to notify players, save game state, etc.
    // For now, we just exit.
    process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Unhandled exception and rejection handlers to prevent crashes
process.on('uncaughtException', (error, origin) => {
    logger.error(`Uncaught Exception at: ${origin}`);
    logger.error(error.stack || error);
    // It's generally unsafe to continue after an uncaught exception.
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Reason:', reason.stack || reason);
    process.exit(1);
});


// Execute the main function.
main();