/**
 * @file examples/telnet-client.js
 * @description A simple Node.js-based client to connect to the server for testing and demonstration purposes.
 * This client connects to the procedural dungeon server over TCP, allows the user to send commands
 * via the terminal, and displays messages received from the server.
 *
 * Usage:
 *   node examples/telnet-client.js --host <hostname> --port <port>
 *
 * Example:
 *   node examples/telnet-client.js --port 8080
 */

import net from 'node:net';
import readline from 'node:readline';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

// --- Configuration ---
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;
const RECONNECT_DELAY_MS = 5000;

// --- Helper Functions ---

/**
 * Parses command-line arguments using yargs.
 * @returns {{host: string, port: number}} The parsed host and port.
 */
function parseArguments() {
  const argv = yargs(hideBin(process.argv))
    .option('host', {
      alias: 'h',
      type: 'string',
      description: 'Server host to connect to',
      default: DEFAULT_HOST,
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Server port to connect to',
      default: DEFAULT_PORT,
    })
    .help()
    .alias('help', 'H')
    .version(false)
    .parse();

  return { host: argv.host, port: argv.port };
}

/**
 * Main function to create and manage the client connection.
 * @param {string} host - The server hostname or IP address.
 * @param {number} port - The server port number.
 */
async function startClient(host, port) {
  let isReconnecting = false;
  let isExiting = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  const connect = () => {
    const socket = new net.Socket();

    console.log(`\n[SYSTEM] Attempting to connect to ${host}:${port}...`);

    socket.connect(port, host, () => {
      isReconnecting = false;
      console.log(`[SYSTEM] Connected to ${host}:${port}. Type 'exit' to quit.`);
      rl.prompt();
    });

    socket.on('data', (data) => {
      const messages = data.toString().trim().split('\n');
      messages.forEach(message => {
        // Clear the current line, print the server message, then redraw the prompt
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(message);
        rl.prompt();
      });
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.error(`\n[ERROR] Connection refused. Is the server running on ${host}:${port}?`);
      } else {
        console.error(`\n[ERROR] Socket error: ${err.message}`);
      }
      // The 'close' event will handle reconnection logic.
    });

    socket.on('close', () => {
      if (isExiting) return;

      if (!isReconnecting) {
        console.log(`\n[SYSTEM] Connection closed. Attempting to reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
        isReconnecting = true;
      }
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    // Handle user input from the terminal
    rl.on('line', (line) => {
      const command = line.trim();
      if (command.toLowerCase() === 'exit') {
        isExiting = true;
        console.log('[SYSTEM] Disconnecting...');
        socket.end();
        rl.close();
        process.exit(0);
      } else if (socket.writable) {
        socket.write(`${command}\n`);
      }
      rl.prompt();
    });

    // Handle graceful shutdown
    rl.on('close', () => {
      if (!isExiting) {
        isExiting = true;
        console.log('\n[SYSTEM] Exiting client.');
        socket.end();
        process.exit(0);
      }
    });
  };

  // Initial connection attempt
  connect();
}

// --- Main Execution ---

// This check ensures the main logic runs only when the script is executed directly.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const { host, port } = parseArguments();
    startClient(host, port);
  } catch (error) {
    console.error(`[FATAL] Failed to start client: ${error.message}`);
    process.exit(1);
  }
}

// Export for potential programmatic use, though not the primary design.
export { startClient };