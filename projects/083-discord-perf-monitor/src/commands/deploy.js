/**
 * @file src/commands/deploy.js
 * @description A utility script to register slash commands with the Discord API.
 *
 * This script is intended to be run from the command line, either on-demand or
 * as part of a deployment process. It reads all command files from the `src/commands`
 * directory, extracts their `SlashCommandBuilder` data, and sends it to Discord
 * via the REST API to register or update them.
 *
 * It supports two modes of deployment:
 * 1. Global: Commands are registered for all guilds the bot is in. This can take
 *    up to an hour to propagate across Discord.
 * 2. Guild-specific: Commands are registered for a single, specified guild. This
 *    is instantaneous and ideal for development and testing.
 *
 * The script uses `yargs-parser` to handle command-line arguments for selecting
 * the deployment mode and specifying a guild ID.
 *
 * Usage:
 *   - Global deployment: `node src/commands/deploy.js`
 *   - Guild deployment:  `node src/commands/deploy.js --guild=<GUILD_ID>`
 */

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs-parser';

// Load environment variables from .env file
config();

const { DISCORD_TOKEN, CLIENT_ID } = process.env;
const argv = yargs(process.argv.slice(2));
const guildId = argv.guild ?? null;

/**
 * Dynamically loads all command definitions from the commands directory.
 * It skips this file ('deploy.js') and any non-JS files.
 * @returns {Promise<object[]>} A promise that resolves to an array of command data objects.
 */
async function loadCommands() {
  const commands = [];
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const commandFiles = await fs.readdir(__dirname);

  console.log('🔍 Finding command files...');

  for (const file of commandFiles) {
    // Skip this deploy script, non-JS files, and any files that don't export 'data'.
    if (file === 'deploy.js' || !file.endsWith('.js')) {
      continue;
    }

    const filePath = path.join(__dirname, file);
    try {
      const commandModule = await import(path.toNamespacedPath(filePath));
      if ('data' in commandModule && 'execute' in commandModule) {
        commands.push(commandModule.data.toJSON());
        console.log(`  - Found command: /${commandModule.data.name}`);
      } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
    }
  }
  return commands;
}

/**
 * Validates that required configuration is present.
 * @throws {Error} if configuration is missing.
 */
function validateConfig() {
  if (!DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is not defined in your environment variables. Please check your .env file.');
  }
  if (!CLIENT_ID) {
    throw new Error('CLIENT_ID is not defined in your environment variables. Please check your .env file.');
  }
}

/**
 * Main function to execute the deployment script.
 */
async function main() {
  try {
    validateConfig();

    const commands = await loadCommands();

    if (commands.length === 0) {
      console.log('No commands found to deploy. Exiting.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    console.log(`\n⏳ Started refreshing ${commands.length} application (/) commands.`);

    let route;
    let deploymentType;

    if (guildId) {
      deploymentType = `for guild ${guildId}`;
      route = Routes.applicationGuildCommands(CLIENT_ID, guildId);
    } else {
      deploymentType = 'globally';
      route = Routes.applicationCommands(CLIENT_ID);
    }

    console.log(`Deploying commands ${deploymentType}...`);

    const data = await rest.put(route, { body: commands });

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands ${deploymentType}.`);

  } catch (error) {
    console.error('❌ Failed to deploy commands:');
    if (error.rawError) {
      // Handle Discord API errors more gracefully
      console.error(`  Status: ${error.status}`);
      console.error(`  Message: ${JSON.stringify(error.rawError, null, 2)}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Execute the main function
main();