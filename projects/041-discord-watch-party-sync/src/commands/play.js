import { SlashCommandBuilder } from 'discord.js';
import partyManager from '../services/party-manager.js';
import { YouTubeService } from '../services/youtube.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler to start a watch party or add a YouTube video to the queue.
 *
 * This command is the entry point for users to interact with the watch party.
 * It handles both creating a new party and adding videos to an existing one.
 * It includes comprehensive checks for user state (e.g., in a voice channel),
 * input validation (valid YouTube URL), and provides clear, actionable feedback
 * to the user through ephemeral and public messages.
 */

/**
 * The data for the /play slash command.
 * It defines the command's name, description, and required 'url' option.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Starts a watch party or adds a video to the queue.')
  .addStringOption(option =>
    option
      .setName('url')
      .setDescription('The YouTube video URL to play.')
      .setRequired(true)
  );

/**
 * Executes the /play command.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The command interaction.
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
  // Defer reply to prevent the interaction from timing out while we process the request.
  // This gives us up to 15 minutes to respond, which is crucial for fetching video info.
  await interaction.deferReply({ ephemeral: true });

  const { guild, guildId, member, user, channel } = interaction;
  const url = interaction.options.getString('url', true);

  // 1. Pre-condition checks
  if (!guildId || !guild) {
    await interaction.editReply({
      content: 'This command can only be used in a server.',
    });
    return;
  }

  if (!member.voice.channel) {
    await interaction.editReply({
      content: 'You must be in a voice channel to start or add to a watch party.',
    });
    return;
  }

  if (!channel) {
    await interaction.editReply({
      content: 'This command must be used in a text channel.',
    });
    return;
  }

  // 2. Validate YouTube URL
  if (!YouTubeService.isValidUrl(url)) {
    await interaction.editReply({
      content: 'The provided URL is not a valid YouTube video link. Please provide a valid `youtube.com` or `youtu.be` link.',
    });
    return;
  }

  try {
    // 3. Fetch video information
    const videoInfo = await YouTubeService.getInfo(url);
    const video = {
      ...videoInfo,
      requestedBy: user,
    };

    // 4. Get or create the watch party
    let party = partyManager.get(guildId);

    if (!party) {
      // Create a new party if one doesn't exist
      logger.info({ guildId, userId: user.id }, 'Creating a new watch party.');
      party = partyManager.create(member.voice.channel, channel, user);
      await interaction.editReply({
        content: `🎉 Watch party started in <#${member.voice.channel.id}>!`,
        ephemeral: false, // Make the "party started" message public
      });
    } else {
      // Check if the user is in the correct voice channel for an existing party
      if (member.voice.channelId !== party.voiceChannel.id) {
        await interaction.editReply({
          content: `You must be in the same voice channel as the party (<#${party.voiceChannel.id}>) to add a video.`,
        });
        return;
      }
    }

    // 5. Enqueue the video
    await party.enqueue(video);

    // 6. Provide feedback to the user
    const currentQueue = party.getQueue();
    const isPlaying = party.getCurrentVideo() !== null;

    if (isPlaying) {
      // If a video is already playing, the new video is added to the queue.
      // The reply should be public to inform others, but the initial defer was ephemeral.
      // We send a new public message and then delete the original ephemeral placeholder.
      await interaction.followUp({
        content: `✅ Added to queue: **${video.title}** (Position: ${currentQueue.length})`,
        ephemeral: false,
      });
      await interaction.deleteReply(); // Clean up the initial ephemeral reply
    } else {
      // If nothing was playing, the `enqueue` method starts playback automatically.
      // The "Now Playing" message is sent by the WatchParty instance itself.
      // We just need to clean up our deferred reply.
      await interaction.deleteReply();
    }

  } catch (error) {
    logger.error({ err: error, guildId, url }, 'Failed to process /play command.');

    let errorMessage = 'An unexpected error occurred while trying to play the video.';
    if (error.name === 'YouTubeError') {
      errorMessage = `❌ Error: ${error.message}`;
    }

    // Ensure we can still reply if the interaction was already handled.
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}