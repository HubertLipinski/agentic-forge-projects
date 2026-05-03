/**
 * @file src/monitors/gateway-events.js
 * @description Wraps the WebSocket event emitter to measure the processing duration of key gateway events.
 *
 * This monitor is essential for understanding how long the bot takes to process
 * incoming data from Discord's WebSocket gateway. High processing times for events
 * like `messageCreate` or `interactionCreate` can indicate bottlenecks in the bot's
 * logic and lead to a sluggish user experience.
 *
 * This implementation works by:
 * 1. Identifying the `client.ws` (WebSocketManager) instance.
 * 2. Monkey-patching the `emit` method of the WebSocketShard's internal event emitter.
 * 3. For a predefined list of critical events, it starts a high-resolution timer
 *    before emitting the event to the bot's listeners.
 * 4. After all synchronous listeners for that event have finished executing, the
 *    timer is stopped. The duration represents the synchronous processing time.
 * 5. This duration is then recorded in a Prometheus Summary metric, which automatically
 *    calculates p50, p90, and p99 percentiles.
 *
 * Note: This method primarily measures the duration of *synchronous* event handlers.
 * Asynchronous work kicked off by an event (e.g., an API call or database query)
 * will not be fully captured by this timer, as the event loop will move on.
 * This is an intentional design choice to measure the "blocking" time on the main thread
 * for each event, which is a key indicator of event loop health.
 */

import { metrics } from '../metrics/prometheus.js';

/**
 * A set of key gateway events that are worth monitoring.
 * Monitoring every single event can be noisy and add unnecessary overhead.
 * We focus on events that are frequent and performance-critical.
 * @type {Set<string>}
 */
const MONITORED_EVENTS = new Set([
  'GUILD_CREATE',
  'GUILD_UPDATE',
  'GUILD_DELETE',
  'MESSAGE_CREATE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE',
  'INTERACTION_CREATE',
  'VOICE_STATE_UPDATE',
  'PRESENCE_UPDATE',
]);

/**
 * A flag to ensure the patching logic is only applied once, even if the
 * `attachGatewayEventMonitor` function is called multiple times.
 * @type {boolean}
 */
let isPatched = false;

/**
 * Patches the `emit` method of a WebSocketShard's event emitter to measure
 * the processing time of specific gateway events.
 *
 * @param {import('events').EventEmitter} emitter - The event emitter instance from a WebSocketShard.
 * @param {number} shardId - The ID of the shard this emitter belongs to, for logging.
 */
function patchEmitter(emitter, shardId) {
  const originalEmit = emitter.emit;

  // Avoid re-patching the same emitter.
  if (originalEmit.isPatchedByMonitor) {
    return;
  }

  emitter.emit = function (event, ...args) {
    // We only care about the events we've explicitly chosen to monitor.
    // The first argument to `emit` is the event name.
    if (!MONITORED_EVENTS.has(event)) {
      return originalEmit.apply(this, [event, ...args]);
    }

    const startTime = process.hrtime();
    let result;

    try {
      // Execute the original `emit`, which calls all the attached listeners.
      result = originalEmit.apply(this, [event, ...args]);
    } finally {
      // This `finally` block executes after all synchronous listeners have run.
      const elapsed = process.hrtime(startTime);
      const durationMs = elapsed[0] * 1000 + elapsed[1] / 1e6;
      const durationSec = durationMs / 1000;

      // Record the measurement in our Prometheus summary.
      metrics.gatewayEventProcessingTime.observe({ event_name: event }, durationSec);
    }

    return result;
  };

  // Add a marker to the function to indicate it has been patched.
  // This prevents multiple patches if the monitor attachment logic is run more than once.
  Object.defineProperty(emitter.emit, 'isPatchedByMonitor', {
    value: true,
    configurable: true, // Allows for potential un-patching in tests or teardown
  });

  console.log(`Gateway Event Monitor: Patched emitter for Shard [${shardId}].`);
}

/**
 * Attaches the gateway event monitor to a Discord client.
 *
 * This function waits for the client to become ready, then iterates through
 * all WebSocket shards, patching the event emitter of each one. It also
 * handles shards that may be spawned dynamically after the initial connection.
 *
 * @param {import('discord.js').Client} client - The Discord client instance.
 */
export function attachGatewayEventMonitor(client) {
  if (!client || !client.ws) {
    console.error('Invalid Discord client provided to attachGatewayEventMonitor.');
    return;
  }

  if (isPatched) {
    console.warn('Gateway Event Monitor has already been attached. Skipping.');
    return;
  }
  isPatched = true;

  /**
   * The core logic for finding and patching shard emitters.
   */
  const applyPatchToShards = () => {
    if (!client.ws.shards || client.ws.shards.size === 0) {
      console.warn('Gateway Event Monitor: No shards found to patch. This may happen with a non-sharded bot before it is ready.');
      return;
    }

    // The `client.ws.shards` is a Collection of WebSocketShard instances.
    for (const shard of client.ws.shards.values()) {
      // The actual event emitter is on `shard.events`.
      if (shard.events && typeof shard.events.emit === 'function') {
        patchEmitter(shard.events, shard.id);
      } else {
        console.error(`Gateway Event Monitor: Could not find event emitter on Shard [${shard.id}].`);
      }
    }
  };

  // The safest time to patch is after the client is ready, as all initial shards
  // will have been created.
  if (client.isReady()) {
    applyPatchToShards();
  } else {
    // If the client is not yet ready, wait for the 'ready' event.
    // Using `once` ensures this listener is removed after it runs.
    client.once('ready', () => {
      console.log('Client is ready, attaching gateway event monitor to shards...');
      applyPatchToShards();
    });
  }

  // Also listen for new shards being created dynamically (e.g., with a sharding manager).
  // The 'shardCreate' event provides the newly created shard instance.
  client.on('shardCreate', (shard) => {
    console.log(`Gateway Event Monitor: New shard [${shard.id}] created. Patching emitter.`);
    if (shard.events && typeof shard.events.emit === 'function') {
      patchEmitter(shard.events, shard.id);
    } else {
      // It's possible the emitter isn't available immediately. We can add a small delay.
      setTimeout(() => {
        if (shard.events && typeof shard.events.emit === 'function') {
          patchEmitter(shard.events, shard.id);
        } else {
          console.error(`Gateway Event Monitor: Still could not find event emitter on newly created Shard [${shard.id}].`);
        }
      }, 100); // 100ms grace period
    }
  });

  console.log('Gateway Event Monitor attached.');
}