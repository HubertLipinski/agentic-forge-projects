#!/usr/bin/env node

/**
 * @file src/cli.js
 * @description The command-line interface (CLI) for the Telnet Roguelike Engine.
 * This script uses `yargs` to parse command-line arguments and launches the
 * game server with the specified configuration. It serves as the main
 * executable entry point for the project, as defined in `package.json`.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import logger from './utils/logger.js';
import { startServer } from './index.js';

/**
 * The main function that sets up and runs the CLI.
 * It parses arguments, validates them, and starts the game server.
 */
async function main() {
    // Get the directory of the current module. This is necessary for resolving
    // relative paths correctly, especially when the CLI is run from different directories.
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, '..');

    const argv = await yargs(hideBin(process.argv))
        .scriptName('telnet-roguelike')
        .usage('$0 [options]')
        .command('$0', 'Start the Telnet Roguelike server', (y) => y)
        .options({
            'port': {
                alias: 'p',
                type: 'number',
                description: 'The port number for the Telnet server to listen on.',
                default: 8080,
                requiresArg: true,
            },
            'host': {
                alias: 'h',
                type: 'string',
                description: 'The host address for the Telnet server to bind to.',
                default: '0.0.0.0',
                requiresArg: true,
            },
            'game': {
                alias: 'g',
                type: 'string',
                description: 'Path to the game directory containing the main entry file and config.',
                default: 'games/default',
                requiresArg: true,
            },
            'log-level': {
                type: 'string',
                description: 'Set the logging level.',
                choices: ['error', 'warn', 'info', 'debug'],
                default: process.env.LOG_LEVEL || 'info',
                requiresArg: true,
            },
        })
        .help()
        .alias('help', 'v')
        .version()
        .epilogue(`For more information, find our repository at ${chalk.cyan('https://github.com/your-username/telnet-roguelike-engine')}`)
        .strict()
        .parse();

    // Apply the log level from the command line arguments.
    // This allows overriding the environment variable.
    logger.setLevel(argv.logLevel);

    logger.info(chalk.bold.hex('#FFA500')('--- Telnet Roguelike Engine ---'));
    logger.info(`Log level set to: ${argv.logLevel}`);

    // Resolve the game path relative to the project root to ensure it works
    // regardless of where the CLI is executed from.
    const gamePath = path.resolve(projectRoot, argv.game);

    const config = {
        port: argv.port,
        host: argv.host,
        gamePath: gamePath,
    };

    try {
        await startServer(config);
    } catch (error) {
        logger.error('A fatal error occurred during server startup:');
        // Log the full error object for detailed debugging, especially the stack trace.
        logger.error(error);
        process.exit(1);
    }
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch(error => {
    logger.error('An unexpected error occurred in the CLI main function:');
    logger.error(error);
    process.exit(1);
});