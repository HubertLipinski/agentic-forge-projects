import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './config/env.js';
import logger from './utils/logger.js';
import partyManager from './services/party-manager.js';

/**
 * @file The main entry point for the Discord Watch Party Sync Bot.
 *
 * This file is responsible for:
 * - Initializing the Discord.js client with the necessary intents.
 * - Loading all slash command handlers from the `src/commands` directory.
 * - Loading all event listeners from the `src/events` directory.
 * - Logging in the bot using the token from environment variables.
 * - Implementing graceful shutdown logic to clean up resources.
 */

/**
 * Asynchronously loads and attaches command handlers to the client.
 *
 * It reads all `.js` files from the `src/commands` directory, imports them,
 * and populates a `Collection` on the client instance. This makes commands
 * accessible from the `interactionCreate` event handler via `interaction.client.commands`.
 *
 * @param {import('discord.js').Client} client The Discord client instance.
 * @returns {Promise<void>} A promise that resolves when all commands are loaded.
 */
async function loadCommands(client) {
  client.commands = new Collection();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const commandsPath = path.join(__dirname, 'commands');

  try {
    const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      // Use dynamic import to load each command module
      const command = await import(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: /${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
    logger.info(`Successfully loaded ${client.commands.size} slash commands.`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load commands from directory.');
    throw new Error('Could not load command files. Aborting startup.');
  }
}

/**
 * Asynchronously loads and registers event handlers with the client.
 *
 * It reads all `.js` files from the `src/events` directory, imports them,
 * and registers them with the client using `client.on` or `client.once`.
 * This modular approach keeps the main file clean and allows for easy
 * addition of new event listeners.
 *
 * @param {import('discord.js').Client} client The Discord client instance.
 * @returns {Promise<void>} A promise that resolves when all events are registered.
 */
async function registerEventHandlers(client) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const eventsPath = path.join(__dirname, 'events');

  try {
    const eventFiles = (await readdir(eventsPath)).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = await import(filePath);

      if ('name' in event && 'execute' in event) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
        logger.debug(`Registered event handler for: ${event.name}`);
      } else {
        logger.warn(`The event handler at ${filePath} is missing a required "name" or "execute" property.`);
      }
    }
    logger.info(`Successfully registered ${eventFiles.length} event handlers.`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to register event handlers.');
    throw new Error('Could not register event handlers. Aborting startup.');
  }
}

/**
 * The main asynchronous function that initializes and runs the bot.
 */
async function main() {
  logger.info('Bot is starting...');

  // 1. Initialize Discord Client
  // These intents are required for the bot to see guild information,
  // connect to voice channels, and read messages/commands.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages, // Optional, but good for potential future features
    ],
  });

  // 2. Load Commands and Events
  try {
    await loadCommands(client);
    await registerEventHandlers(client);
  } catch (error) {
    logger.fatal({ err: error }, 'A critical error occurred during initialization. The bot will not start.');
    process.exit(1);
  }

  // 3. Log in to Discord
  try {
    logger.info('Logging in to Discord...');
    await client.login(env.DISCORD_TOKEN);
    logger.info(`Bot logged in as ${client.user?.tag}`);
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to log in to Discord. Check if the token is valid.');
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown of the application.
 * This function is registered with process exit signals.
 * @param {string} signal The signal that triggered the shutdown.
 */
function handleShutdown(signal) {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);

  // Destroy all active watch parties to disconnect from voice channels.
  const allParties = partyManager.getAll();
  if (allParties.size > 0) {
    logger.info(`Destroying ${allParties.size} active watch parties.`);
    allParties.forEach((party, guildId) => {
      partyManager.remove(guildId);
    });
  }

  // The process will exit automatically after this handler completes.
  logger.info('Shutdown complete. Goodbye!');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Unhandled exception/rejection handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error, origin) => {
  logger.fatal({ err: error, origin }, 'Uncaught Exception thrown');
  // In a real production environment, you might want to consider a more
  // robust restart mechanism, but for now, we exit to prevent an unknown state.
  process.exit(1);
});

// Start the application
main();