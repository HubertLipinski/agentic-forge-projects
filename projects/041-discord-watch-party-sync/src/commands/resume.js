import { SlashCommandBuilder } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler for the host to resume playback.
 *
 * This command allows the designated host of a watch party to resume a
 * currently paused video. It includes checks to ensure that the command
 * is used in the correct context (i.e., a party exists, a video is paused,
 * and the user is the host).
 */

/**
 * The data for the /resume slash command.
 * It defines the command's name and description.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resumes the current video playback.');

/**
 * Executes the /resume command.
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
      content: 'There is no active watch party to resume.',
      ephemeral: true,
    });
    return;
  }

  // 4. Authorize the user: Check if they are the host.
  if (party.host.id !== user.id) {
    await interaction.reply({
      content: `Only the current host, <@${party.host.id}>, can resume the video.`,
      ephemeral: true,
    });
    return;
  }

  // 5. Check if the user is in the correct voice channel.
  // This prevents a host who has left the channel from controlling playback.
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (member?.voice.channelId !== party.voiceChannel.id) {
    await interaction.reply({
      content: `You must be in the party's voice channel (<#${party.voiceChannel.id}>) to use this command.`,
      ephemeral: true,
    });
    return;
  }

  // 6. Attempt to resume playback and provide feedback.
  try {
    const success = party.resume();

    if (success) {
      const currentVideo = party.getCurrentVideo();
      const videoTitle = currentVideo?.title ?? 'the current video';

      logger.info({ guildId, userId: user.id }, 'Playback resumed by host.');
      await interaction.reply({
        content: `▶️ Resumed: **${videoTitle}**`,
        // Public message so everyone knows the state has changed.
        ephemeral: false,
      });
    } else {
      // This case handles when the video is already playing or not in a pausable state.
      logger.warn({ guildId, userId: user.id }, 'Attempted to resume when not in a paused state.');
      await interaction.reply({
        content: 'The video is not currently paused.',
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'An unexpected error occurred while resuming playback.');
    await interaction.reply({
      content: 'An unexpected error occurred. Please try again.',
      ephemeral: true,
    });
  }
}