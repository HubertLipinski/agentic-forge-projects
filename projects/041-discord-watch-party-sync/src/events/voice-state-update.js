import { Events } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @fileoverview Event listener for 'voiceStateUpdate'.
 *
 * This module handles changes in voice states for users, such as joining,
 * leaving, or moving between voice channels. Its primary responsibility is to
 * automatically clean up and end a watch party session when the bot is left
 * alone in its voice channel. This prevents the bot from occupying a channel
 * indefinitely after a party has concluded.
 */

/**
 * The name of the event this module handles.
 * @type {string}
 */
export const name = Events.VoiceStateUpdate;

/**
 * Executes the logic for the 'voiceStateUpdate' event.
 *
 * This function is triggered whenever a user's voice state changes. It checks
 * if the change occurred in a channel where a watch party is active. If a user
* leaves and the bot is the only one remaining, it triggers the party's
 * destruction.
 *
 * @param {import('discord.js').VoiceState} oldState The voice state before the update.
 * @param {import('discord.js').VoiceState} newState The voice state after the update.
 * @returns {Promise<void>}
 */
export async function execute(oldState, newState) {
  // We are only interested in users leaving a channel.
  // A "leave" event is when a user was in a channel (oldState.channelId is not null)
  // but is no longer in that channel (newState.channelId is null or different).
  if (!oldState.channelId || oldState.channelId === newState.channelId) {
    return;
  }

  const { guild, client } = oldState;
  const party = partyManager.get(guild.id);

  // If there's no active party in this guild, or if the user left a channel
  // that isn't the party's channel, we have nothing to do.
  if (!party || oldState.channelId !== party.voiceChannel.id) {
    return;
  }

  // The bot's own voice state changes should not trigger cleanup.
  if (oldState.member?.id === client.user?.id) {
    return;
  }

  // At this point, a user has left the watch party's voice channel.
  // We need to check if the bot is now alone.

  // Re-fetch the channel from the cache to get the most up-to-date member list.
  const channel = await guild.channels.fetch(oldState.channelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) {
    // Channel might have been deleted. If so, the party should be cleaned up.
    // The Disconnected event on the VoiceConnection in WatchParty should handle this,
    // but we can be proactive.
    logger.warn({ guildId: guild.id, channelId: oldState.channelId }, 'Party channel not found after voiceStateUpdate. Forcing cleanup.');
    partyManager.remove(guild.id);
    return;
  }

  // Get all members in the channel, excluding the bot itself.
  const humanMembers = channel.members.filter(member => !member.user.bot);

  // If there are no human members left in the channel...
  if (humanMembers.size === 0) {
    logger.info(
      { guildId: guild.id, channelId: channel.id },
      'All users have left the voice channel. Cleaning up the watch party.'
    );

    try {
      // Send a final message to the text channel associated with the party.
      if (party.textChannel) {
        await party.textChannel.send('👋 Everyone has left the party. See you next time!');
      }

      // The `remove` method handles the full destruction and cleanup of the party.
      partyManager.remove(guild.id);
    } catch (error) {
      logger.error(
        { err: error, guildId: guild.id },
        'An error occurred during automatic party cleanup.'
      );
    }
  } else {
    // If other users are still present, we check if the host was the one who left.
    // If so, we can transfer host to another user.
    if (oldState.member?.id === party.host.id) {
      const newHost = humanMembers.first(); // Pick the first non-bot user as the new host.
      if (newHost) {
        party.setHost(newHost.user);
        logger.info(
          { guildId: guild.id, oldHostId: oldState.member.id, newHostId: newHost.id },
          'Host left the channel. Automatically transferred host role.'
        );
        if (party.textChannel) {
          await party.textChannel.send(`👑 The host <@${oldState.member.id}> has left. <@${newHost.id}> is now the new host!`);
        }
      }
    }
  }
}