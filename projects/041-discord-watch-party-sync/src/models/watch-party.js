import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { Collection } from 'discord.js';
import logger from '../utils/logger.js';
import { YouTubeService } from '../services/youtube.js';

/**
 * @typedef {import('discord.js').VoiceBasedChannel} VoiceBasedChannel
 * @typedef {import('discord.js').TextBasedChannel} TextBasedChannel
 * @typedef {import('discord.js').User} User
 * @typedef {import('@discordjs/voice').VoiceConnection} VoiceConnection
 * @typedef {import('@discordjs/voice').AudioPlayer} AudioPlayer
 */

/**
 * @typedef {object} Video
 * @property {string} url - The YouTube video URL.
 * @property {string} title - The video's title.
 * @property {number} duration - The video's duration in seconds.
 * @property {string} thumbnail - URL of the video's thumbnail.
 * @property {string} channel - The name of the YouTube channel.
 * @property {User} requestedBy - The Discord user who added the video.
 */

/**
 * Represents a single watch party session in a Discord guild.
 *
 * This class encapsulates all the state and logic for a co-watching session,
 * including the voice connection, audio player, video queue, and playback controls.
 * It is designed to be managed by the `PartyManager`.
 */
export class WatchParty {
  /**
   * The Discord guild ID this party belongs to.
   * @type {string}
   */
  guildId;

  /**
   * The voice channel the party is in.
   * @type {VoiceBasedChannel}
   */
  voiceChannel;

  /**
   * The text channel for sending status updates.
   * @type {TextBasedChannel}
   */
  textChannel;

  /**
   * The user who has control over playback (the host).
   * @type {User}
   */
  host;

  /**
   * The underlying voice connection.
   * @type {VoiceConnection}
   * @private
   */
  #connection;

  /**
   * The audio player responsible for streaming.
   * @type {AudioPlayer}
   * @private
   */
  #player;

  /**
   * A collection of videos to be played.
   * @type {Collection<string, Video>}
   * @private
   */
  #queue;

  /**
   * The video that is currently playing or paused.
   * @type {Video | null}
   * @private
   */
  #currentVideo = null;

  /**
   * A lock to prevent concurrent play operations.
   * @type {boolean}
   * @private
   */
  #isPlaying = false;

  /**
   * A timeout for inactivity, to automatically disconnect.
   * @type {NodeJS.Timeout | null}
   * @private
   */
  #inactivityTimeout = null;

  /**
   * Creates a new WatchParty instance.
   * @param {VoiceBasedChannel} voiceChannel - The voice channel to join.
   * @param {TextBasedChannel} textChannel - The text channel for updates.
   * @param {User} host - The initial host of the party.
   */
  constructor(voiceChannel, textChannel, host) {
    this.guildId = voiceChannel.guild.id;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.host = host;

    this.#queue = new Collection();
    this.#player = createAudioPlayer();

    this.#connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    this.#setupEventHandlers();
  }

  /**
   * Sets up event handlers for the voice connection and audio player.
   * @private
   */
  #setupEventHandlers() {
    // Handle state changes for the audio player
    this.#player.on(AudioPlayerStatus.Idle, () => {
      logger.info({ guildId: this.guildId }, 'Player is idle.');
      this.#currentVideo = null;
      this.#isPlaying = false;
      // Play the next video in the queue if available
      this.#playNext().catch(error => {
        logger.error({ err: error, guildId: this.guildId }, 'Error playing next video.');
        this.textChannel.send('An error occurred while trying to play the next video.');
      });
    });

    this.#player.on('error', (error) => {
      logger.error({ err: error, guildId: this.guildId }, 'Audio player error.');
      this.textChannel.send('An error occurred during playback. Skipping to the next video.');
      // Attempt to recover by playing the next video
      this.#playNext().catch(e => logger.error({ err: e, guildId: this.guildId }, 'Recovery play failed.'));
    });

    // Handle state changes for the voice connection
    this.#connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        logger.warn({ guildId: this.guildId }, 'Voice connection disconnected. Attempting to rejoin...');
        // Wait for a maximum of 5 seconds for the connection to be re-established
        await Promise.race([
          entersState(this.#connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.#connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Connection re-established
        logger.info({ guildId: this.guildId }, 'Successfully rejoined voice channel.');
      } catch (error) {
        logger.error({ err: error, guildId: this.guildId }, 'Could not rejoin voice channel. Destroying connection.');
        this.destroy();
      }
    });

    this.#connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info({ guildId: this.guildId }, 'Voice connection destroyed.');
      this.stop();
    });

    // Subscribe the connection to the player
    this.#connection.subscribe(this.#player);
  }

  /**
   * Adds a video to the queue and starts playback if idle.
   * @param {Video} video - The video object to add.
   * @returns {Promise<void>}
   */
  async enqueue(video) {
    this.#queue.set(video.url, video);
    logger.info({ guildId: this.guildId, videoTitle: video.title }, 'Video enqueued.');

    // If nothing is playing, start playback immediately.
    if (!this.#isPlaying) {
      await this.#playNext();
    }
  }

  /**
   * Pauses the current video playback.
   * @returns {boolean} True if paused successfully, false otherwise.
   */
  pause() {
    if (this.#player.state.status === AudioPlayerStatus.Playing) {
      const success = this.#player.pause();
      if (success) {
        logger.info({ guildId: this.guildId }, 'Playback paused.');
        this.#clearInactivityTimeout();
      }
      return success;
    }
    return false;
  }

  /**
   * Resumes the current video playback.
   * @returns {boolean} True if resumed successfully, false otherwise.
   */
  resume() {
    if (this.#player.state.status === AudioPlayerStatus.Paused) {
      const success = this.#player.unpause();
      if (success) {
        logger.info({ guildId: this.guildId }, 'Playback resumed.');
        this.#resetInactivityTimeout();
      }
      return success;
    }
    return false;
  }

  /**
   * Skips the current video and plays the next one in the queue.
   * @returns {Promise<void>}
   */
  async skip() {
    if (this.#queue.size === 0 && this.#currentVideo) {
      logger.info({ guildId: this.guildId }, 'Skipping last video.');
      this.#player.stop(true); // Stop player, which will trigger idle state
      return;
    }
    if (this.#queue.size > 0) {
      logger.info({ guildId: this.guildId }, 'Skipping to next video.');
      this.#player.stop(true); // This will trigger the 'idle' event, which calls #playNext
    } else {
      logger.info({ guildId: this.guildId }, 'Skip called on empty queue.');
      await this.textChannel.send('The queue is empty. Nothing to skip to.');
    }
  }

  /**
   * Stops playback, clears the queue, and prepares for destruction.
   */
  stop() {
    logger.info({ guildId: this.guildId }, 'Stopping watch party.');
    this.#queue.clear();
    this.#currentVideo = null;
    this.#isPlaying = false;
    this.#player.stop(true);
    this.#clearInactivityTimeout();
  }

  /**
   * Completely destroys the watch party, disconnecting from voice.
   */
  destroy() {
    logger.info({ guildId: this.guildId }, 'Destroying watch party instance.');
    this.stop();
    if (this.#connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.#connection.destroy();
    }
  }

  /**
   * Changes the host of the party.
   * @param {User} newHost - The new host user.
   */
  setHost(newHost) {
    logger.info({ guildId: this.guildId, oldHost: this.host.tag, newHost: newHost.tag }, 'Changing host.');
    this.host = newHost;
  }

  /**
   * Gets the current video queue.
   * @returns {Video[]} An array of videos in the queue.
   */
  getQueue() {
    return Array.from(this.#queue.values());
  }

  /**
   * Gets the currently playing video.
   * @returns {Video | null} The current video or null if none.
   */
  getCurrentVideo() {
    return this.#currentVideo;
  }

  /**
   * Plays the next video from the queue.
   * @private
   * @returns {Promise<void>}
   */
  async #playNext() {
    if (this.#isPlaying || this.#queue.size === 0) {
      if (this.#queue.size === 0) {
        logger.info({ guildId: this.guildId }, 'Queue is empty. Setting inactivity timeout.');
        this.#resetInactivityTimeout();
      }
      return;
    }

    this.#isPlaying = true;
    this.#clearInactivityTimeout();

    const nextVideoUrl = this.#queue.firstKey();
    if (!nextVideoUrl) {
      this.#isPlaying = false;
      return;
    }

    const video = this.#queue.shift();
    if (!video) {
      this.#isPlaying = false;
      return;
    }

    this.#currentVideo = video;

    try {
      const stream = YouTubeService.createStream(video.url);
      const resource = createAudioResource(stream);
      this.#player.play(resource);
      logger.info({ guildId: this.guildId, videoTitle: video.title }, 'Started playing video.');
      await this.textChannel.send(`▶️ Now Playing: **${video.title}**`);
    } catch (error) {
      logger.error({ err: error, videoUrl: video.url, guildId: this.guildId }, 'Failed to play video.');
      this.textChannel.send(`❌ Could not play **${video.title}**. Skipping.`);
      this.#isPlaying = false;
      this.#currentVideo = null;
      // Try to play the next one
      await this.#playNext();
    }
  }

  /**
   * Resets the inactivity timeout. If it fires, the party is destroyed.
   * @private
   */
  #resetInactivityTimeout() {
    this.#clearInactivityTimeout();
    // 5 minutes of inactivity
    const timeoutDuration = 5 * 60 * 1000;
    this.#inactivityTimeout = setTimeout(() => {
      if (!this.#isPlaying && this.#connection.state.status !== VoiceConnectionStatus.Destroyed) {
        logger.info({ guildId: this.guildId }, 'Inactivity timeout reached. Destroying party.');
        this.textChannel.send('Watch party ended due to inactivity.');
        this.destroy();
      }
    }, timeoutDuration);
  }

  /**
   * Clears the inactivity timeout.
   * @private
   */
  #clearInactivityTimeout() {
    if (this.#inactivityTimeout) {
      clearTimeout(this.#inactivityTimeout);
      this.#inactivityTimeout = null;
    }
  }
}