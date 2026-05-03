/**
 * @file src/index.js
 * @description Main entry point for the Discord Performance Monitor Bot.
 *
 * This file orchestrates the entire application. It is responsible for:
 * - Loading configuration from environment variables.
 * - Initializing the Discord.js client with necessary intents.
 * - Setting up and starting the Prometheus metrics server.
 * - Attaching all performance monitors (command latency, API requests, etc.) to the client.
 * - Handling process-wide error events (uncaught exceptions, unhandled rejections).
 * - Managing the bot's login process and lifecycle.
 * - Dynamically loading and handling slash command executions.
 */

import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config.js';
import { metrics } from './metrics/prometheus.js';
import { attachCommandLatencyMonitor } from './monitors/command-latency.js';
import { attachApiRequestMonitor } from './monitors/api-request.js';
import { attachGatewayEventMonitor } from './monitors/gateway-events.js';
import { attachProcessStatsMonitor, stopProcessStatsMonitor } from './monitors/process-stats.js';
import * as summaryCommand from './commands/summary.js';

// --- Main Application Logic ---

/**
 * The main function that initializes and runs the bot.
 * It's wrapped in an async function to allow top-level await.
 */
async function main() {
  console.log('Starting Discord Performance Monitor Bot...');

  // --- Initialize Prometheus Metrics Server ---
  try {
    await metrics.start({ port: config.metricsPort });
  } catch (error) {
    console.error('Failed to start Prometheus metrics server:', error);
    // This is a critical failure, as the primary purpose of the bot is to expose metrics.
    process.exit(1);
  }

  // --- Initialize Discord Client ---
  // The bot needs minimal intents. It only needs to see guilds to report the count.
  // It doesn't need to read messages, as it operates on slash commands.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // Required for guild count, etc.
    ],
  });

  // --- Command Handling Setup ---
  client.commands = new Collection();
  // Load commands into the client's command collection.
  // In a larger bot, this would be a dynamic loop over a commands directory.
  client.commands.set(summaryCommand.data.name, summaryCommand);
  console.log(`Loaded ${client.commands.size} slash command(s).`);

  // --- Attach All Performance Monitors ---
  // These functions hook into the client and process to gather metrics.
  attachApiRequestMonitor(client);
  attachCommandLatencyMonitor(client);
  attachGatewayEventMonitor(client);
  attachProcessStatsMonitor();

  // --- Setup Client Event Handlers ---

  // Handle incoming slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching '${interaction.commandName}' was found.`);
      try {
        await interaction.reply({
          content: 'Error: This command does not exist.',
          ephemeral: true,
        });
      } catch (replyError) {
        console.error('Failed to send command-not-found reply:', replyError);
      }
      return;
    }

    try {
      // The command latency monitor will have already patched the interaction
      // to measure execution time.
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command '${interaction.commandName}':`, error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    }
  });

  // Fired when the client becomes ready to start working.
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`);
    console.log(`Monitoring ${readyClient.guilds.cache.size} guilds.`);

    // Set initial gauge values now that the client is ready.
    metrics.guildCount.set({ client_id: readyClient.user.id }, readyClient.guilds.cache.size);

    // Periodically update gateway latency and guild count.
    setInterval(() => {
      if (client.ws.ping >= 0) {
        metrics.gatewayLatency.set({ client_id: readyClient.user.id }, client.ws.ping);
      }
      metrics.guildCount.set({ client_id: readyClient.user.id }, client.guilds.cache.size);
    }, 30 * 1000); // Update every 30 seconds
  });

  // Log guild changes to keep the guild count metric accurate.
  client.on(Events.GuildCreate, (guild) => {
    console.log(`Joined a new guild: ${guild.name} (${guild.id})`);
    metrics.guildCount.inc({ client_id: client.user.id });
  });

  client.on(Events.GuildDelete, (guild) => {
    console.log(`Left a guild: ${guild.name} (${guild.id})`);
    metrics.guildCount.dec({ client_id: client.user.id });
  });

  // --- Login to Discord ---
  try {
    await client.login(config.discordToken);
  } catch (error) {
    console.error('Failed to log in to Discord:', error);
    process.exit(1);
  }

  return client;
}

// --- Process-wide Error Handling & Shutdown ---

/**
 * Handles graceful shutdown of the application.
 * @param {string} signal - The signal that triggered the shutdown.
 * @param {Client} client - The active Discord client instance.
 */
async function gracefulShutdown(signal, client) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  // Stop listening for new events
  if (client) {
    await client.destroy();
    console.log('Discord client destroyed.');
  }

  // Stop monitors and servers
  stopProcessStatsMonitor();
  await metrics.stop();

  console.log('Shutdown complete.');
  process.exit(0);
}

// Start the main application
main().then(client => {
  // Handle process termination signals
  process.on('SIGINT', (signal) => gracefulShutdown(signal, client));
  process.on('SIGTERM', (signal) => gracefulShutdown(signal, client));
}).catch(error => {
  console.error('Unhandled error during bot initialization:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  metrics.processErrors.inc({ error_type: 'unhandledRejection' });
  // In a production environment, you might want to log this to an external service.
});

// Handle uncaught exceptions
process.on('uncaughtException', (error, origin) => {
  console.error(`Uncaught Exception: ${error.message}`, `Origin: ${origin}`, error.stack);
  metrics.processErrors.inc({ error_type: 'uncaughtException' });
  // Per Node.js recommendation, it's not safe to continue after an uncaught exception.
  // We log it and then exit. A process manager (like PM2) should restart the bot.
  process.exit(1);
});