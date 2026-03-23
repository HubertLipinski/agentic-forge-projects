import { Events } from 'discord.js';
import logger from '../utils/logger.js';

/**
 * @fileoverview Event listener for 'interactionCreate'.
 *
 * This module is responsible for handling all incoming interactions from Discord.
 * It primarily focuses on routing slash command interactions to their respective
 * command handlers. It acts as the central dispatcher for all user commands.
 */

/**
 * Dynamically loads all command handlers from the `src/commands` directory.
 *
 * This function reads all `.js` files from the commands directory, imports them,
 * and maps them into a `Collection` where the key is the command name and the
 * value is the command's exported module (containing `data` and `execute`).
 * This approach allows for easy addition of new commands without modifying the
 * event handler.
 *
 * @returns {Promise<import('discord.js').Collection<string, object>>} A promise that resolves to a collection of commands.
 */
async function loadCommands() {
  const { readdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { Collection } = await import('discord.js');

  const commands = new Collection();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);

    // Set a new item in the Collection with the key as the command name
    // and the value as the exported module.
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      logger.debug(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
  return commands;
}

/**
 * The name of the event this module handles.
 * @type {string}
 */
export const name = Events.InteractionCreate;

/**
 * The main execution function for the 'interactionCreate' event.
 *
 * This function is called by the Discord.js client whenever a new interaction
 * is received. It identifies if the interaction is a chat input command,
 * finds the corresponding command handler, and executes it. It includes
 * comprehensive error handling to prevent the bot from crashing due to a
 * faulty command and provides feedback to the user.
 *
 * @param {import('discord.js').Interaction} interaction The interaction object from Discord.
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
  // We only care about slash commands (ChatInputCommand).
  // Other interaction types (buttons, modals, etc.) could be handled here
  // in the future if the bot's functionality expands.
  if (!interaction.isChatInputCommand()) {
    return;
  }

  // The client object is attached with all its properties, including the 'commands'
  // collection we created in `src/index.js`.
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching '${interaction.commandName}' was found.`);
    try {
      await interaction.reply({
        content: `Error: The command '${interaction.commandName}' does not exist.`,
        ephemeral: true,
      });
    } catch (replyError) {
      logger.error({ err: replyError }, 'Failed to send "command not found" reply.');
    }
    return;
  }

  const logContext = {
    commandName: interaction.commandName,
    guildId: interaction.guildId,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
  };

  logger.info(logContext, 'Executing command.');

  try {
    // Execute the command's logic.
    await command.execute(interaction);
  } catch (error) {
    logger.error({ ...logContext, err: error }, 'An error occurred while executing a command.');

    // It's crucial to inform the user that something went wrong.
    // Interactions can be replied to, followed up on, or edited. We need to
    // handle cases where the command might have already sent a reply.
    const errorMessage = {
      content: 'There was an error while executing this command! Please try again later.',
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        // If a reply has already been sent or deferred, use followUp.
        await interaction.followUp(errorMessage);
      } else {
        // Otherwise, send a new reply.
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      logger.error({ ...logContext, err: replyError }, 'Failed to send error feedback to the user.');
    }
  }
}

// Exporting `loadCommands` to be used in the main entry point (`src/index.js`)
// to populate the client's command collection on startup.
export { loadCommands };