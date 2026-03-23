import { SlashCommandBuilder } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler to end the watch party session and clear the queue.
 *
 * This command allows the designated host to completely stop the watch party,
 * clear the video queue, and disconnect the bot from the voice channel.
 * It includes authorization checks to ensure only the host can end the session.
 */

/**
 * The data for the /stop slash command.
 * It defines the command's name and description.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stops the watch party, clears the queue, and disconnects the bot.');

/**
 * Executes the /stop command.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The command interaction.
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
  const { guildId, user } = interaction;

  // 1. Pre-condition: Ensure the command is used within a guild.
  if (!guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  // 2. Retrieve the watch party for the current guild.
  const party = partyManager.get(guildId);

  // 3. Validate that a watch party exists.
  if (!party) {
    await interaction.reply({
      content: 'There is no active watch party to stop.',
      ephemeral: true,
    });
    return;
  }

  // 4. Authorize the user: Check if they are the host.
  if (party.host.id !== user.id) {
    await interaction.reply({
      content: `Only the current host, <@${party.host.id}>, can stop the party.`,
      ephemeral: true,
    });
    return;
  }

  // 5. Check if the user is in the correct voice channel.
  // This is a good practice to ensure the host is still present when ending the party.
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (member?.voice.channelId !== party.voiceChannel.id) {
    await interaction.reply({
      content: `You must be in the party's voice channel (<#${party.voiceChannel.id}>) to use this command.`,
      ephemeral: true,
    });
    return;
  }

  // 6. Attempt to stop the party and provide feedback.
  try {
    logger.info({ guildId, userId: user.id }, 'Host is stopping the watch party.');

    // The partyManager.remove() method handles calling the party's internal
    // `destroy` method, which stops playback, clears the queue, and disconnects
    // the voice connection. It also removes the party instance from the manager.
    const wasRemoved = partyManager.remove(guildId);

    if (wasRemoved) {
      await interaction.reply({
        content: '⏹️ The watch party has been stopped. The queue is cleared, and I have left the voice channel.',
        // Public message so everyone knows the party has ended.
        ephemeral: false,
      });
    } else {
      // This is an unlikely edge case where the party existed at the start of the
      // command execution but was removed by another process before this point.
      logger.warn({ guildId }, 'Attempted to stop a party that was removed concurrently.');
      await interaction.reply({
        content: 'The watch party seems to have already ended.',
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'An unexpected error occurred while stopping the watch party.');
    // Use followUp if the reply was already sent or deferred.
    const replyOptions = {
      content: 'An unexpected error occurred while trying to stop the party. Please try again.',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  }
}