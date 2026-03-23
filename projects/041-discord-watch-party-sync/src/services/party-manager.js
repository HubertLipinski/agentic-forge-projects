import { Collection } from 'discord.js';
import { WatchParty } from '../models/watch-party.js';
import logger from '../utils/logger.js';

/**
 * @fileoverview Manages all active watch party sessions across different guilds.
 *
 * This module acts as a singleton service, providing a centralized point of access
 * for creating, retrieving, and destroying `WatchParty` instances. It uses a
 * Discord.js `Collection` to map guild IDs to their respective watch party sessions,
 * ensuring that each guild can only have one active party at a time.
 */

/**
 * @typedef {import('discord.js').VoiceBasedChannel} VoiceBasedChannel
 * @typedef {import('discord.js').TextBasedChannel} TextBasedChannel
 * @typedef {import('discord.js').User} User
 */

/**
 * A singleton class that manages all active `WatchParty` instances.
 */
class PartyManager {
  /**
   * A map of guild IDs to their active WatchParty instance.
   * @type {Collection<string, WatchParty>}
   * @private
   */
  #parties;

  constructor() {
    if (PartyManager.instance) {
      return PartyManager.instance;
    }
    this.#parties = new Collection();
    PartyManager.instance = this;
  }

  /**
   * Creates a new watch party for a guild or returns the existing one.
   *
   * If a party already exists for the given guild, this method will return
   * the existing instance instead of creating a new one. This prevents
   * multiple concurrent sessions in the same guild.
   *
   * @param {VoiceBasedChannel} voiceChannel - The voice channel for the party.
   * @param {TextBasedChannel} textChannel - The text channel for status updates.
   * @param {User} host - The user who initiated the party.
   * @returns {WatchParty} The newly created or existing `WatchParty` instance.
   */
  create(voiceChannel, textChannel, host) {
    const { guildId } = voiceChannel;

    const existingParty = this.get(guildId);
    if (existingParty) {
      logger.warn(
        { guildId },
        'Attempted to create a party where one already exists. Returning existing party.'
      );
      return existingParty;
    }

    logger.info({ guildId, hostId: host.id }, 'Creating new watch party.');
    const newParty = new WatchParty(voiceChannel, textChannel, host);
    this.#parties.set(guildId, newParty);
    return newParty;
  }

  /**
   * Retrieves the watch party for a specific guild.
   *
   * @param {string} guildId - The ID of the guild to look up.
   * @returns {WatchParty | undefined} The `WatchParty` instance if one exists, otherwise `undefined`.
   */
  get(guildId) {
    return this.#parties.get(guildId);
  }

  /**
   * Removes and destroys the watch party for a specific guild.
   *
   * This method ensures the party is properly cleaned up by calling its `destroy`
   * method, which handles disconnecting from voice and clearing internal state.
   * It is safe to call even if no party exists for the given guild.
   *
   * @param {string} guildId - The ID of the guild whose party should be removed.
   * @returns {boolean} `true` if a party was found and removed, `false` otherwise.
   */
  remove(guildId) {
    const party = this.#parties.get(guildId);
    if (party) {
      logger.info({ guildId }, 'Removing and destroying watch party.');
      party.destroy();
      this.#parties.delete(guildId);
      return true;
    }
    logger.debug(
      { guildId },
      'Attempted to remove a party that does not exist.'
    );
    return false;
  }

  /**
   * Checks if a watch party exists for a given guild.
   *
   * @param {string} guildId - The ID of the guild to check.
   * @returns {boolean} `true` if a party exists, `false` otherwise.
   */
  has(guildId) {
    return this.#parties.has(guildId);
  }

  /**
   * Retrieves all active watch parties.
   *
   * @returns {Collection<string, WatchParty>} A collection of all active parties.
   */
  getAll() {
    return this.#parties;
  }
}

/**
 * The singleton instance of the PartyManager.
 * Import this instance to manage watch parties throughout the application.
 *
 * @example
 * import partyManager from './services/party-manager.js';
 * const party = partyManager.get(guildId);
 * if (party) {
 *   party.pause();
 * }
 */
const partyManager = new PartyManager();
Object.freeze(partyManager);

export default partyManager;