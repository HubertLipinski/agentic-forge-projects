/**
 * @file examples/tcp-client-logger.js
 * @description A simple Node.js script that sends log lines to a TCP port,
 * for testing the aggregator's TCP source.
 *
 * This utility connects to a specified TCP host and port and sends a log message
 * every few seconds. It demonstrates how a separate application or service
 * could stream its logs to the log-stream-aggregator.
 *
 * Usage:
 *   node examples/tcp-client-logger.js [--port 3000] [--host localhost] [--interval 2000]
 *
 * Arguments:
 *   --port:     The TCP port to connect to (default: 3000).
 *   --host:     The hostname or IP address to connect to (default: 'localhost').
 *   --interval: The interval in milliseconds between sending logs (default: 2000).
 *   --count:    The total number of messages to send before exiting (default: 10).
 */

import net from 'node:net';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---

// Parse command-line arguments for configuration.
// A simple parser is sufficient for this example script.
const getConfig = () => {
  const args = process.argv.slice(2);
  const config = {
    port: 3000,
    host: 'localhost',
    interval: 2000,
    count: 10,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      config.port = parseInt(args[i + 1], 10);
    } else if (args[i] === '--host' && args[i + 1]) {
      config.host = args[i + 1];
    } else if (args[i] === '--interval' && args[i + 1]) {
      config.interval = parseInt(args[i + 1], 10);
    } else if (args[i] === '--count' && args[i + 1]) {
      config.count = parseInt(args[i + 1], 10);
    }
  }

  // Basic validation
  if (isNaN(config.port) || config.port <= 0 || config.port > 65535) {
    console.error(`Invalid port: ${config.port}. Please provide a number between 1 and 65535.`);
    process.exit(1);
  }
  if (isNaN(config.interval) || config.interval < 0) {
    console.error(`Invalid interval: ${config.interval}. Please provide a non-negative number.`);
    process.exit(1);
  }
  if (isNaN(config.count) || config.count < 0) {
    console.error(`Invalid count: ${config.count}. Please provide a non-negative number.`);
    process.exit(1);
  }


  return config;
};

// --- Log Generation ---

const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const logMessages = [
  'User authentication successful',
  'Database query executed',
  'Failed to connect to upstream service',
  'Processing background job',
  'Cache miss for key',
  'API request received',
];

/**
 * Generates a random log line.
 * Half of the time it generates a plain text log, and half the time a JSON structured log.
 * @returns {string} A log line string, terminated with a newline character.
 */
function generateLogLine() {
  const level = logLevels[Math.floor(Math.random() * logLevels.length)];
  const message = logMessages[Math.floor(Math.random() * logMessages.length)];
  const requestId = uuidv4();

  // 50% chance to send a structured JSON log
  if (Math.random() > 0.5) {
    const jsonLog = {
      level,
      message: `${message} (request_id: ${requestId.slice(0, 8)})`,
      service: 'tcp-client-logger',
      requestId,
      pid: process.pid,
      timestamp: new Date().toISOString(), // The aggregator will overwrite this, but it's realistic to include.
    };
    return `${JSON.stringify(jsonLog)}\n`;
  }

  // Otherwise, send a plain text log
  return `[${level}] [${new Date().toLocaleTimeString()}] ${message}\n`;
}

// --- Main Execution Logic ---

/**
 * The main function that connects to the TCP server and sends logs periodically.
 * @param {object} config - The configuration object.
 * @param {string} config.host - The target host.
 * @param {number} config.port - The target port.
 * @param {number} config.interval - The sending interval in ms.
 * @param {number} config.count - The number of messages to send.
 */
export async function runTcpClient({ host, port, interval, count }) {
  console.log(`Attempting to connect to log aggregator at tcp://${host}:${port}`);

  const client = new net.Socket();
  let messagesSent = 0;
  let intervalId = null;

  const connect = () => {
    client.connect(port, host, () => {
      console.log('Successfully connected. Starting to send logs...');
      console.log(`Will send ${count} messages every ${interval}ms.`);

      // Send the first message immediately on connect
      sendMessage();

      // Then set up the interval for subsequent messages
      if (count > 1) {
        intervalId = setInterval(sendMessage, interval);
      }
    });
  };

  const sendMessage = () => {
    if (messagesSent >= count) {
      console.log('Finished sending all messages. Closing connection.');
      client.end(); // Gracefully close the connection
      if (intervalId) clearInterval(intervalId);
      return;
    }

    const logLine = generateLogLine();
    try {
      const flushed = client.write(logLine, 'utf8', () => {
        process.stdout.write(`Sent: ${logLine.trim()}\n`);
      });

      // Handle backpressure if the kernel buffer is full
      if (!flushed) {
        console.warn('TCP backpressure detected. Pausing sending...');
        if (intervalId) clearInterval(intervalId);
        client.once('drain', () => {
          console.log('TCP drain event received. Resuming sending.');
          if (count > messagesSent) {
            intervalId = setInterval(sendMessage, interval);
          }
        });
      }

      messagesSent++;
    } catch (error) {
      console.error('Error writing to socket:', error.message);
      client.destroy(); // Destroy socket on write error
    }
  };

  client.on('error', (err) => {
    console.error(`TCP client error: ${err.message}`);
    // For a simple script, we just exit. A more robust client might retry.
    process.exit(1);
  });

  client.on('close', () => {
    console.log('Connection closed.');
    if (intervalId) clearInterval(intervalId);
  });

  // Initiate the connection
  connect();
}

// --- Script Entry Point ---

// This block ensures the script runs only when executed directly.
// It allows `runTcpClient` to be imported and used in other modules (e.g., tests)
// without automatically running.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const config = getConfig();
  runTcpClient(config).catch(err => {
    console.error('An unexpected error occurred:', err);
    process.exit(1);
  });
}