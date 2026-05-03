/**
 * @file src/metrics/prometheus.js
 * @description Initializes and manages prom-client metrics and exposes the HTTP server for Prometheus scraping.
 *
 * This module is the central hub for all Prometheus metrics. It defines the standard
 * metrics used across the application (gauges, histograms, counters) and provides
 * a singleton `MetricsService` to manage them.
 *
 * It is responsible for:
 * 1. Defining key performance indicators (KPIs) as Prometheus metrics.
 * 2. Creating and starting a lightweight HTTP server to expose the `/metrics` endpoint.
 * 3. Providing a clean, centralized interface for other modules (monitors) to update these metrics.
 *
 * The service is designed to be initialized once at application startup.
 */

import http from 'node:http';
import {
  register,
  collectDefaultMetrics,
  Gauge,
  Counter,
  Histogram,
  Summary,
} from 'prom-client';

const METRICS_ENDPOINT = '/metrics';
const CONTENT_TYPE_HEADER = 'Content-Type';

/**
 * Manages the lifecycle of Prometheus metrics and the metrics server.
 * This class follows a singleton pattern, ensuring only one instance of the metrics
 * service and server exists throughout the application's lifetime.
 * @class
 */
class MetricsService {
  /**
   * @private
   */
  constructor() {
    /**
     * The HTTP server instance for serving metrics.
     * @type {http.Server | null}
     * @private
     */
    this.server = null;
    /**
     * The port on which the metrics server is running.
     * @type {number | null}
     * @private
     */
    this.port = null;
    /**
     * A flag to prevent multiple initializations.
     * @type {boolean}
     * @private
     */
    this.isInitialized = false;

    // --- Metric Definitions ---

    /**
     * Tracks the current number of guilds the bot is in.
     * @type {Gauge<'client_id'>}
     */
    this.guildCount = new Gauge({
      name: 'discord_guilds_total',
      help: 'Total number of guilds the bot is a member of.',
      labelNames: ['client_id'],
    });

    /**
     * Tracks the current WebSocket gateway latency.
     * @type {Gauge<'client_id'>}
     */
    this.gatewayLatency = new Gauge({
      name: 'discord_gateway_latency_ms',
      help: 'The current latency of the WebSocket connection to the Discord gateway in milliseconds.',
      labelNames: ['client_id'],
    });

    /**
     * Measures the duration of command executions. A histogram is used to
     * automatically calculate quantiles (p50, p90, p99) and sum/count.
     * @type {Histogram<'command_name' | 'success'>}
     */
    this.commandLatency = new Histogram({
      name: 'discord_command_latency_seconds',
      help: 'Latency of slash command executions in seconds.',
      labelNames: ['command_name', 'success'],
      // Buckets in seconds, from 50ms to 10s.
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    /**
     * Counts the number of Discord API requests made.
     * @type {Counter<'method' | 'path' | 'status_code'>}
     */
    this.apiRequestCounter = new Counter({
      name: 'discord_api_requests_total',
      help: 'Total number of Discord API requests made.',
      labelNames: ['method', 'path', 'status_code'],
    });

    /**
     * Measures the duration of Discord API requests.
     * @type {Histogram<'method' | 'path'>}
     */
    this.apiRequestLatency = new Histogram({
      name: 'discord_api_request_latency_seconds',
      help: 'Latency of Discord API requests in seconds.',
      labelNames: ['method', 'path'],
      // Buckets in seconds, from 50ms to 5s.
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    /**
     * Measures the processing time for key gateway events.
     * @type {Summary<'event_name'>}
     */
    this.gatewayEventProcessingTime = new Summary({
      name: 'discord_gateway_event_processing_seconds',
      help: 'Time taken to process a gateway event in seconds.',
      labelNames: ['event_name'],
      percentiles: [0.5, 0.9, 0.99], // p50, p90, p99
    });

    /**
     * Tracks Node.js process memory usage.
     * @type {Gauge<'memory_type'>}
     */
    this.processMemoryUsage = new Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Memory usage of the Node.js process in bytes.',
      labelNames: ['memory_type'], // e.g., 'rss', 'heapTotal', 'heapUsed'
    });

    /**
     * Tracks Node.js process CPU usage.
     * @type {Gauge<never>}
     */
    this.processCpuUsage = new Gauge({
      name: 'nodejs_cpu_usage_ratio',
      help: 'The percentage of CPU time spent by the process since the last measurement (0 to 1).',
    });

    /**
     * Counts uncaught exceptions and unhandled promise rejections.
     * @type {Counter<'error_type'>}
     */
    this.processErrors = new Counter({
      name: 'nodejs_process_errors_total',
      help: 'Total number of uncaught exceptions or unhandled rejections.',
      labelNames: ['error_type'], // 'uncaughtException' or 'unhandledRejection'
    });
  }

  /**
   * Initializes the metrics service and starts the HTTP server.
   * This method should only be called once.
   *
   * @param {object} options - Configuration options.
   * @param {number} options.port - The port for the metrics server.
   * @param {string} [options.prefix] - A prefix for all metric names.
   * @returns {Promise<void>} A promise that resolves when the server is listening.
   */
  async start({ port, prefix = 'discord_monitor_' }) {
    if (this.isInitialized) {
      console.warn('MetricsService is already initialized. Ignoring subsequent call to start().');
      return;
    }
    if (!port || typeof port !== 'number' || port <= 0) {
      throw new Error('A valid port must be provided to start the metrics server.');
    }

    this.port = port;
    this.isInitialized = true;

    // Clear any default metrics from a previous run (e.g., in a test environment)
    register.clear();

    // Add a prefix to all our custom metrics
    register.setDefaultLabels({ serviceName: 'discord-performance-monitor' });
    collectDefaultMetrics({ prefix });

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === METRICS_ENDPOINT) {
          try {
            res.setHeader(CONTENT_TYPE_HEADER, register.contentType);
            res.end(await register.metrics());
          } catch (err) {
            console.error('Error generating Prometheus metrics:', err);
            res.writeHead(500, { [CONTENT_TYPE_HEADER]: 'text/plain' });
            res.end('Internal Server Error');
          }
        } else {
          res.writeHead(404, { [CONTENT_TYPE_HEADER]: 'text/plain' });
          res.end('Not Found');
        }
      });

      this.server.on('error', (err) => {
        console.error(`Metrics server error: ${err.message}`);
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`Prometheus metrics server listening on http://localhost:${this.port}${METRICS_ENDPOINT}`);
        resolve();
      });
    });
  }

  /**
   * Stops the metrics server and cleans up resources.
   * @returns {Promise<void>} A promise that resolves when the server is closed.
   */
  async stop() {
    if (!this.server || !this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        if (err) {
          console.error('Error closing metrics server:', err);
          return reject(err);
        }
        console.log('Prometheus metrics server stopped.');
        this.server = null;
        this.isInitialized = false;
        register.clear();
        resolve();
      });
    });
  }
}

/**
 * Singleton instance of the MetricsService.
 * Use this instance throughout the application to interact with Prometheus metrics.
 *
 * @example
 * import { metrics } from './src/metrics/prometheus.js';
 *
 * // In your command monitor
 * const endTimer = metrics.commandLatency.startTimer({ command_name: 'ping' });
 * // ... execute command ...
 * endTimer({ success: 'true' });
 */
export const metrics = new MetricsService();