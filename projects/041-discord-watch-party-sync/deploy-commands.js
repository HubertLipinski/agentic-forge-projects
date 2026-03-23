import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './src/config/env.js';
import logger from './src/utils/logger.js';

/**
 * @fileoverview Script for deploying Discord slash commands.
 *
 * This script reads all command definition files from the `src/commands` directory,
 * extracts their `data` property (which should be a SlashCommandBuilder instance),
 * and registers them with the Discord API.
 *
 * It is designed to be run from the command line (e.g., `node deploy-commands.js`)
 * before starting the bot, or whenever commands are added, removed, or changed.
 *
 * The script registers commands for a specific guild specified by `GUILD_ID`
 * in the environment variables. This is ideal for development and testing, as
 * guild-specific commands update instantly. For production, you might adapt this
 * to register global commands.
 */

/**
 * Dynamically loads command data from all command files.
 *
 * @returns {Promise<object[]>} A promise that resolves to an array of command data objects.
 */
async function loadCommandData() {
  const commands = [];
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const commandsPath = path.join(__dirname, 'src', 'commands');

  try {
    const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      // Use a dynamic import to load each command module.
      // The `file://` protocol is necessary for ES modules on Windows.
      const command = await import(path.toFileUrl(filePath).toString());

      if (command.data) {
        commands.push(command.data.toJSON());
        logger.debug(`Loaded command data for: ${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing a "data" property and was skipped.`);
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to read command files from directory.');
    throw new Error('Could not load command files.');
  }

  return commands;
}

/**
 * Registers the slash commands with the Discord API for a specific guild.
 *
 * @param {object[]} commands - An array of command data objects to register.
 */
async function registerCommands(commands) {
  if (commands.length === 0) {
    logger.warn('No commands found to deploy. Exiting.');
    return;
  }

  // The REST module is used to make requests to the Discord API.
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands for guild ${env.GUILD_ID}.`);

    // The `put` method is used to fully refresh all commands in the guild with the current set.
    // This will add new commands, update existing ones, and remove any that are no longer in the list.
    const data = await rest.put(
      Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
      { body: commands },
    );

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // Log the full error for debugging, as API errors can be complex.
    logger.error({ err: error }, 'Failed to register application commands with Discord API.');
    // Re-throw to ensure the script exits with a non-zero status code on failure.
    throw error;
  }
}

/**
 * Main function to orchestrate the command deployment process.
 */
async function main() {
  try {
    logger.info('Starting command deployment process...');
    const commandData = await loadCommandData();
    await registerCommands(commandData);
    logger.info('Command deployment process finished successfully.');
  } catch (error) {
    logger.fatal('Command deployment failed. The application might not work correctly.');
    // Exit with an error code to signal failure in CI/CD environments.
    process.exit(1);
  }
}

// Execute the main function when the script is run directly.
main();