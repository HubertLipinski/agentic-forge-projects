/**
 * @file src/commands/summary.js
 * @description Implements the '/perf-summary' slash command, which fetches aggregated data and formats it into a readable Discord embed.
 *
 * This command provides an on-demand, human-readable snapshot of the bot's performance.
 * It pulls data from the various aggregators maintained by the monitors (e.g., command latency,
 * API request rates) and presents it in a concise and clear Discord embed. This allows
 * bot operators to quickly check the health of their bot without needing to access
 * a full Prometheus/Grafana stack.
 */

import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';
import { commandLatencyAggregator } from '../monitors/command-latency.js';
import { apiRequestRateAggregator, apiRateLimitAggregator } from '../monitors/api-request.js';

/**
 * Formats a duration in milliseconds into a more readable string.
 * e.g., 1234ms -> "1.23s", 56ms -> "56ms"
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted duration string.
 */
function formatDuration(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
        return 'N/A';
    }
    if (ms < 1000) {
        return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Formats a number with commas as thousands separators.
 * @param {number} num - The number to format.
 * @returns {string} The formatted number string.
 */
function formatNumber(num) {
    if (typeof num !== 'number' || !Number.isFinite(num)) {
        return 'N/A';
    }
    return num.toLocaleString('en-US');
}

/**
 * Calculates and returns various process and application uptime strings.
 * @returns {{processUptime: string, clientUptime: string}} An object containing formatted uptime strings.
 */
function getUptimeInfo(client) {
    const processUptimeSeconds = process.uptime();
    const clientUptimeSeconds = client.uptime / 1000;

    const formatUptime = (seconds) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (s > 0 || parts.length === 0) parts.push(`${s}s`);

        return parts.join(' ');
    };

    return {
        processUptime: formatUptime(processUptimeSeconds),
        clientUptime: formatUptime(clientUptimeSeconds),
    };
}

/**
 * Gathers all performance data from aggregators and the client.
 * @param {import('discord.js').Client} client - The Discord client instance.
 * @returns {object} An object containing all the performance metrics.
 */
function gatherPerformanceData(client) {
    // Command Latency
    const p50 = commandLatencyAggregator.estimate(0.5);
    const p90 = commandLatencyAggregator.estimate(0.9);
    const p99 = commandLatencyAggregator.estimate(0.99);
    const commandCount = commandLatencyAggregator.totalCount;

    // API Usage
    const requestsLastMin = apiRequestRateAggregator.sum();
    const rateLimitsLastMin = apiRateLimitAggregator.sum();

    // Process & Client Info
    const { rss, heapUsed, heapTotal } = process.memoryUsage();
    const { processUptime, clientUptime } = getUptimeInfo(client);
    const gatewayLatency = client.ws.ping >= 0 ? `${client.ws.ping}ms` : 'N/A';

    return {
        command: {
            p50,
            p90,
            p99,
            count: commandCount,
        },
        api: {
            requestsPerMin: requestsLastMin,
            rateLimitsPerMin: rateLimitsLastMin,
        },
        process: {
            memoryRss: (rss / 1024 / 1024).toFixed(2),
            memoryHeapUsed: (heapUsed / 1024 / 1024).toFixed(2),
            memoryHeapTotal: (heapTotal / 1024 / 1024).toFixed(2),
            uptime: processUptime,
        },
        client: {
            uptime: clientUptime,
            gatewayLatency,
            guilds: client.guilds.cache.size,
        },
    };
}

export const data = new SlashCommandBuilder()
    .setName('perf-summary')
    .setDescription('Displays a summary of the bot\'s current performance metrics.')
    .setDMPermission(true); // Allow use in DMs for bot owners

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const { client } = interaction;
        const perfData = gatherPerformanceData(client);

        const summaryEmbed = new EmbedBuilder()
            .setColor(0x5865F2) // Discord blurple
            .setTitle('📈 Performance Summary')
            .setDescription(`Metrics for **${client.user.username}** since last restart.`)
            .setTimestamp()
            .setFooter({ text: `Node.js ${process.version} | discord.js v${djsVersion}` })
            .addFields(
                // Command Latency Section
                {
                    name: '⚡ Command Latency',
                    value: [
                        `**p50 (Median):** \`${formatDuration(perfData.command.p50)}\``,
                        `**p90:** \`${formatDuration(perfData.command.p90)}\``,
                        `**p99:** \`${formatDuration(perfData.command.p99)}\``,
                        `*Total Executions: ${formatNumber(perfData.command.count)}*`,
                    ].join('\n'),
                    inline: true,
                },
                // API Usage Section
                {
                    name: '🌐 Discord API',
                    value: [
                        `**Gateway Ping:** \`${perfData.client.gatewayLatency}\``,
                        `**Requests (last min):** \`${formatNumber(perfData.api.requestsPerMin)}\``,
                        `**Rate Limits (last min):** \`${formatNumber(perfData.api.rateLimitsPerMin)}\``,
                        `*Serving ${formatNumber(perfData.client.guilds)} guilds*`,
                    ].join('\n'),
                    inline: true,
                },
                // Process/Resource Usage Section
                {
                    name: '🖥️ Process & Memory',
                    value: [
                        `**Memory (RSS):** \`${perfData.process.memoryRss} MB\``,
                        `**Memory (Heap):** \`${perfData.process.memoryHeapUsed} / ${perfData.process.memoryHeapTotal} MB\``,
                        `**Process Uptime:** \`${perfData.process.uptime}\``,
                        `**Client Uptime:** \`${perfData.client.uptime}\``,
                    ].join('\n'),
                    inline: false, // Full width for better readability
                }
            );

        await interaction.editReply({ embeds: [summaryEmbed] });
    } catch (error) {
        console.error('Error executing /perf-summary command:', error);
        // If we already deferred, we must use editReply or followUp.
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: '❌ An error occurred while fetching the performance summary.',
                ephemeral: true,
            });
        } else {
            // This case is unlikely but handled for robustness.
            await interaction.reply({
                content: '❌ An error occurred while fetching the performance summary.',
                ephemeral: true,
            });
        }
    }
}