import { SlashCommandBuilder } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler for the host to pause the current video.
 *
 * This command allows the designated host of a watch party to pause the
 * currently playing video. It includes several checks to ensure that the
 * command is used in the correct context (i.e., a party exists, a video is
 * playing, and the user is the host).
 */

/**
 * The data for the /pause slash command.
 * It defines the command's name and description.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pauses the current video playback.');

/**
 * Executes the /pause command.
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
      content: 'There is no active watch party to pause.',
      ephemeral: true,
    });
    return;
  }

  // 4. Authorize the user: Check if they are the host.
  if (party.host.id !== user.id) {
    await interaction.reply({
      content: `Only the current host, <@${party.host.id}>, can pause the video.`,
      ephemeral: true,
    });
    return;
  }

  // 5. Check if the user is in the correct voice channel.
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (member?.voice.channelId !== party.voiceChannel.id) {
    await interaction.reply({
      content: `You must be in the party's voice channel (<#${party.voiceChannel.id}>) to use this command.`,
      ephemeral: true,
    });
    return;
  }

  // 6. Attempt to pause the playback and provide feedback.
  try {
    const success = party.pause();

    if (success) {
      const currentVideo = party.getCurrentVideo();
      const videoTitle = currentVideo?.title ?? 'the current video';

      logger.info({ guildId, userId: user.id }, 'Playback paused by host.');
      await interaction.reply({
        content: `⏸️ Paused: **${videoTitle}**`,
        // Public message so everyone knows the state has changed.
        ephemeral: false,
      });
    } else {
      // This case handles when the video is already paused or not playing.
      logger.warn({ guildId, userId: user.id }, 'Attempted to pause when not in a playing state.');
      await interaction.reply({
        content: 'The video is not currently playing or is already paused.',
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'An unexpected error occurred while pausing playback.');
    await interaction.reply({
      content: 'An unexpected error occurred. Please try again.',
      ephemeral: true,
    });
  }
}