import { SlashCommandBuilder } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler for the host to skip to the next video in the queue.
 *
 * This command allows the designated host of a watch party to skip the
 * currently playing video and immediately start the next one in the queue.
 * It includes checks for host authorization, party existence, and queue status.
 */

/**
 * The data for the /skip slash command.
 * It defines the command's name and description.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skips the current video and plays the next one in the queue.');

/**
 * Executes the /skip command.
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
      content: 'There is no active watch party to skip a video in.',
      ephemeral: true,
    });
    return;
  }

  // 4. Authorize the user: Check if they are the host.
  if (party.host.id !== user.id) {
    await interaction.reply({
      content: `Only the current host, <@${party.host.id}>, can skip videos.`,
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

  // 6. Check if there is a video currently playing to skip.
  const currentVideo = party.getCurrentVideo();
  if (!currentVideo) {
    await interaction.reply({
      content: 'There is no video currently playing to skip.',
      ephemeral: true,
    });
    return;
  }

  // 7. Attempt to skip the video and provide feedback.
  try {
    // Defer the reply as the skip operation might involve async actions
    // within the WatchParty class (e.g., playing the next video).
    await interaction.deferReply({ ephemeral: false });

    const videoTitle = currentVideo.title;
    const queue = party.getQueue();

    logger.info({ guildId, userId: user.id, videoTitle }, 'Host is skipping video.');

    // The `skip` method in WatchParty will handle stopping the current player
    // and triggering the 'idle' event, which in turn plays the next video.
    await party.skip();

    // The WatchParty's `playNext` method sends the "Now Playing" message.
    // We just need to confirm the skip action.
    if (queue.length > 0) {
      // The next video will be played by the party's event handler.
      await interaction.editReply({
        content: `⏭️ Skipped **${videoTitle}**.`,
      });
    } else {
      // This was the last video in the queue.
      await interaction.editReply({
        content: `⏭️ Skipped **${videoTitle}**. The queue is now empty.`,
      });
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'An unexpected error occurred while skipping video.');

    const errorMessage = 'An unexpected error occurred while trying to skip the video. Please try again.';
    // Use followUp since we deferred the reply.
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}