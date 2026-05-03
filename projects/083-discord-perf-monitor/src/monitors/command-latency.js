/**
 * @file src/monitors/command-latency.js
 * @description Hooks into 'interactionCreate' to measure the time between receiving a command and sending a reply, feeding data to aggregators and Prometheus.
 *
 * This monitor is crucial for understanding the performance of the bot's commands.
 * It works by:
 * 1. Attaching a listener to the `client.on('interactionCreate', ...)` event.
 * 2. When an interaction is a command, it starts a high-resolution timer.
 * 3. It then patches the interaction's `reply`, `deferReply`, `editReply`, and `followUp` methods.
 *    This allows it to detect when the bot sends its first response to the user.
 * 4. Once a reply method is called, the timer is stopped, and the latency is calculated.
 * 5. This latency is then recorded in both the Prometheus histogram and a local `PercentileEstimator`
 *    for on-demand summaries.
 * 6. It also handles cases where a command might fail or time out without replying.
 */

import { InteractionType } from 'discord.js';
import { PercentileEstimator } from '../lib/aggregators/percentile.js';
import { metrics } from '../metrics/prometheus.js';

// A weak map to track timers for ongoing interactions.
// Using a WeakMap allows garbage collection if the interaction object is somehow lost.
const interactionTimers = new WeakMap();

/**
 * A streaming aggregator for command latency percentiles (p50, p90, p99).
 * This provides data for the `/perf-summary` command.
 */
export const commandLatencyAggregator = new PercentileEstimator();

/**
 * Records the latency for a completed command interaction.
 *
 * @param {import('discord.js').CommandInteraction} interaction - The command interaction.
 * @param {boolean} success - Whether the command executed successfully.
 * @param {number} startTime - The high-resolution start time `[seconds, nanoseconds]`.
 */
function recordLatency(interaction, success, startTime) {
    if (!interactionTimers.has(interaction)) {
        // Already recorded, or was never tracked.
        return;
    }
    interactionTimers.delete(interaction);

    const elapsed = process.hrtime(startTime);
    const latencyMs = elapsed[0] * 1000 + elapsed[1] / 1e6;
    const latencySec = latencyMs / 1000;

    const commandName = interaction.commandName ?? 'unknown';

    // Record for Prometheus
    metrics.commandLatency.observe(
        { command_name: commandName, success: String(success) },
        latencySec
    );

    // Record for internal percentile aggregation
    commandLatencyAggregator.add(latencyMs);
}

/**
 * Wraps the reply methods of an interaction to intercept the first reply
 * and record the command latency.
 *
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to patch.
 * @param {number} startTime - The high-resolution start time `[seconds, nanoseconds]`.
 */
function patchInteractionReply(interaction, startTime) {
    const originalReply = interaction.reply.bind(interaction);
    const originalEditReply = interaction.editReply.bind(interaction);
    const originalFollowUp = interaction.followUp.bind(interaction);
    const originalDeferReply = interaction.deferReply.bind(interaction);

    const record = (success) => recordLatency(interaction, success, startTime);

    // `reply` is the most common method for responding.
    interaction.reply = (...args) => {
        record(true);
        return originalReply(...args);
    };

    // `deferReply` is also a valid first response.
    interaction.deferReply = (...args) => {
        record(true);
        return originalDeferReply(...args);
    };

    // `editReply` is used after a deferral.
    interaction.editReply = (...args) => {
        // An edit after a deferral is what completes the interaction from the user's perspective.
        // If the timer is still running, it means this is the first "real" response.
        if (interactionTimers.has(interaction)) {
            record(true);
        }
        return originalEditReply(...args);
    };

    // `followUp` is for subsequent messages, but could be the first if the initial reply failed.
    interaction.followUp = (...args) => {
        if (interactionTimers.has(interaction)) {
            record(true);
        }
        return originalFollowUp(...args);
    };
}

/**
 * The main handler for the 'interactionCreate' event. It filters for commands,
 * starts timers, and patches interactions.
 *
 * @param {import('discord.js').Interaction} interaction - The incoming interaction.
 */
async function handleInteractionCreate(interaction) {
    // We only care about command-like interactions (slash commands, context menus).
    if (
        !interaction.isChatInputCommand() &&
        !interaction.isMessageContextMenuCommand() &&
        !interaction.isUserContextMenuCommand()
    ) {
        return;
    }

    // Avoid tracking the same interaction twice if the event fires multiple times for any reason.
    if (interactionTimers.has(interaction)) {
        return;
    }

    const startTime = process.hrtime();
    interactionTimers.set(interaction, startTime);

    patchInteractionReply(interaction, startTime);

    // Set a timeout to catch commands that never reply.
    // Discord interactions time out after 15 minutes, but we should consider it a failure much sooner.
    // 3 seconds is the initial window for a reply/defer. We'll use a slightly longer grace period.
    setTimeout(() => {
        if (interactionTimers.has(interaction)) {
            // If the timer still exists, it means no reply was sent.
            // Record as a failure.
            console.warn(`Command '${interaction.commandName}' timed out without replying.`);
            recordLatency(interaction, false, startTime);
        }
    }, 5000); // 5 seconds
}

/**
 * Attaches the command latency monitor to a Discord client.
 *
 * @param {import('discord.js').Client} client - The Discord client instance.
 */
export function attachCommandLatencyMonitor(client) {
    if (!client || !client.on) {
        console.error('Invalid Discord client provided to attachCommandLatencyMonitor.');
        return;
    }

    // Wrap the handler in a try-catch to prevent the monitor from crashing the bot's event loop.
    const safeHandler = async (interaction) => {
        try {
            await handleInteractionCreate(interaction);
        } catch (error) {
            console.error('Error in command latency monitor:', error);
            // If an error occurs, ensure we clean up any pending timer for this interaction.
            if (interactionTimers.has(interaction)) {
                const startTime = interactionTimers.get(interaction);
                recordLatency(interaction, false, startTime);
            }
        }
    };

    client.on('interactionCreate', safeHandler);

    console.log('Command Latency Monitor attached.');
}