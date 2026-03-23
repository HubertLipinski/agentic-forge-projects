import ytdl from 'ytdl-core';
import logger from '../utils/logger.js';

/**
 * @fileoverview A service module for interacting with YouTube.
 *
 * This module provides a wrapper around the `ytdl-core` library to fetch
 * YouTube video information and create readable audio streams. It includes
 * robust error handling and formats the data into a consistent structure
 * for use within the application.
 */

/**
 * Custom error class for YouTube service-related issues.
 * This helps in distinguishing YouTube-specific errors from other application errors.
 */
class YouTubeError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Optional parameters.
   * @param {Error} [options.cause] The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'YouTubeError';
  }
}

/**
 * Validates a given string to see if it is a valid YouTube video URL.
 *
 * @param {string} url The URL to validate.
 * @returns {boolean} True if the URL is a valid YouTube video URL, false otherwise.
 */
function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return ytdl.validateURL(url);
}

/**
 * Fetches detailed information for a given YouTube video URL.
 *
 * @param {string} url The YouTube video URL.
 * @returns {Promise<{
 *   url: string;
 *   title: string;
 *   duration: number;
 *   thumbnail: string;
 *   channel: string;
 * }>} A promise that resolves to an object containing the video's metadata.
 * @throws {YouTubeError} If the URL is invalid or if fetching fails.
 */
async function getVideoInfo(url) {
  if (!isValidYouTubeUrl(url)) {
    throw new YouTubeError('Invalid or unsupported YouTube URL provided.');
  }

  try {
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;

    if (!videoDetails) {
      throw new Error('ytdl.getInfo did not return videoDetails.');
    }

    return {
      url: videoDetails.video_url,
      title: videoDetails.title,
      duration: parseInt(videoDetails.lengthSeconds, 10),
      thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || '',
      channel: videoDetails.ownerChannelName,
    };
  } catch (error) {
    logger.error({ err: error, url }, 'Failed to fetch YouTube video info.');
    // Re-throw a more user-friendly and specific error.
    throw new YouTubeError(`Could not retrieve information for the video. Please check the link and try again.`, { cause: error });
  }
}

/**
 * Creates a readable audio stream from a YouTube URL.
 *
 * This stream is optimized for use with `@discordjs/voice` by selecting an
 * opus format and a high watermark to ensure smooth playback.
 *
 * @param {string} url The YouTube video URL.
 * @returns {import('stream').Readable} A readable stream of the video's audio.
 * @throws {YouTubeError} If the stream cannot be created.
 */
function createAudioStream(url) {
  if (!isValidYouTubeUrl(url)) {
    throw new YouTubeError('Invalid YouTube URL provided for streaming.');
  }

  try {
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      // The highWaterMark is crucial for preventing stuttering. It defines the
      // buffer size. A larger buffer means more data is fetched in advance.
      // 1 << 25 is 32MB, a good balance for most connections.
      highWaterMark: 1 << 25,
    });

    // Attach an error handler to the stream itself to catch any runtime
    // issues during download. This prevents the bot from crashing if ytdl
    // encounters a problem mid-stream.
    stream.on('error', (error) => {
      logger.error({ err: error, url }, 'Error occurred within the ytdl audio stream.');
      // The stream will close automatically on error, but this logging is vital.
    });

    return stream;
  } catch (error) {
    logger.error({ err: error, url }, 'Failed to create YouTube audio stream.');
    throw new YouTubeError('Could not create an audio stream for the video.', { cause: error });
  }
}

export const YouTubeService = {
  isValidUrl: isValidYouTubeUrl,
  getInfo: getVideoInfo,
  createStream: createAudioStream,
};