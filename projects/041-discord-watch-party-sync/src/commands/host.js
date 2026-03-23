import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import partyManager from '../services/party-manager.js';
import logger from '../utils/logger.js';

/**
 * @file Slash command handler for assigning a new host for the watch party.
 *
 * This command allows the current host of a watch party to transfer their
 * control to another user in the same voice channel. It includes checks to
 * ensure the command is used correctly and provides clear feedback to the users.
 */

/**
 * The data for the /host slash command.
 * It defines the command's name, description, and options.
 * The 'new-host' option is a required user mention.
 *
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('host')
  .setDescription('Transfers host controls to another user.')
  .addUserOption(option =>
    option
      .setName('new-host')
      .setDescription('The user to make the new host.')
      .setRequired(true)
  );

/**
 * Executes the /host command.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The command interaction.
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
  const { guildId, user: interactionUser, member: interactionMember } = interaction;

  if (!guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const party = partyManager.get(guildId);

  if (!party) {
    await interaction.reply({
      content: 'There is no active watch party to transfer hosting for.',
      ephemeral: true,
    });
    return;
  }

  // Check if the user invoking the command is the current host.
  if (party.host.id !== interactionUser.id) {
    await interaction.reply({
      content: `Only the current host, <@${party.host.id}>, can transfer control.`,
      ephemeral: true,
    });
    return;
  }

  const newHostUser = interaction.options.getUser('new-host', true);

  // Prevent a user from transferring host to themselves.
  if (newHostUser.id === interactionUser.id) {
    await interaction.reply({
      content: 'You are already the host.',
      ephemeral: true,
    });
    return;
  }

  // Prevent transferring host to a bot.
  if (newHostUser.bot) {
    await interaction.reply({
      content: 'You cannot transfer host controls to a bot.',
      ephemeral: true,
    });
    return;
  }

  // Ensure the new host is in the same voice channel as the party.
  const newHostMember = await interaction.guild?.members.fetch(newHostUser.id).catch(() => null);
  if (!newHostMember || newHostMember.voice.channelId !== party.voiceChannel.id) {
    await interaction.reply({
      content: `The new host, ${newHostUser.tag}, must be in the same voice channel (<#${party.voiceChannel.id}>) to receive control.`,
      ephemeral: true,
    });
    return;
  }

  try {
    const oldHost = party.host;
    party.setHost(newHostUser);

    logger.info(
      {
        guildId,
        oldHostId: oldHost.id,
        newHostId: newHostUser.id,
      },
      'Host successfully transferred.'
    );

    await interaction.reply({
      content: `👑 Host controls have been transferred from <@${oldHost.id}> to <@${newHostUser.id}>.`,
      // Make this message public so everyone in the channel is aware of the change.
      ephemeral: false,
    });
  } catch (error) {
    logger.error({ err: error, guildId }, 'An unexpected error occurred while transferring host.');
    await interaction.reply({
      content: 'An unexpected error occurred while trying to transfer the host. Please try again.',
      ephemeral: true,
    });
  }
}