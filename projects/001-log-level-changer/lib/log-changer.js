import { spawn } from 'child_process';
import { inspect } from 'util';

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];

/**
 * Checks if a given log level is valid.
 * @param {string} level - The log level to check.
 * @returns {boolean} True if the level is valid, false otherwise.
 */
function isValidLogLevel(level) {
  return VALID_LOG_LEVELS.includes(level.toLowerCase());
}

/**
 * Sends a message to a target Node.js process to change its log level.
 * This function communicates with the target process by sending it a message.
 * The target process is expected to have a listener for 'log-level-change' messages.
 *
 * @param {number} pid - The Process ID of the target Node.js application.
 * @param {string} moduleName - The name of the module to change the log level for. If empty, it targets the global log level.
 * @param {string} level - The desired log level (e.g., 'debug', 'info', 'warn', 'error', 'silent').
 * @returns {Promise<void>} A promise that resolves when the message is sent successfully.
 * @throws {Error} If the target process is not found, or if there's an error sending the message.
 */
async function changeLogLevel(pid, moduleName, level) {
  if (!isValidLogLevel(level)) {
    throw new Error(`Invalid log level: "${level}". Supported levels are: ${VALID_LOG_LEVELS.join(', ')}.`);
  }

  const message = {
    type: 'log-level-change',
    payload: {
      module: moduleName || null, // null indicates global
      level: level.toLowerCase(),
    },
  };

  try {
    // Use process.kill with signal 0 to check if the process exists without sending a signal.
    // This is a common way to check process existence in Node.js.
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') {
      throw new Error(`Process with PID ${pid} not found.`);
    }
    throw new Error(`Failed to check process ${pid}: ${error.message}`);
  }

  try {
    // Send the message to the target process.
    // Note: This relies on the target process having a message handler for 'log-level-change'.
    // The target process must also be running with the same Node.js version or compatible
    // to handle the message structure correctly.
    process.send(message, pid);
    // We don't await a response here as process.send is fire-and-forget by default
    // for child processes. For inter-process communication, a more robust mechanism
    // like IPC channels or a dedicated communication library might be needed for
    // confirmation, but for this CLI's purpose, sending the message is sufficient.
  } catch (error) {
    throw new Error(`Failed to send log level change message to PID ${pid}: ${error.message}`);
  }
}

/**
 * Sends a message to a target Node.js process to list available modules.
 * This function communicates with the target process by sending it a message.
 * The target process is expected to have a listener for 'list-log-modules' messages
 * and to respond with a message containing the list of modules.
 *
 * @param {number} pid - The Process ID of the target Node.js application.
 * @returns {Promise<string[]>} A promise that resolves with an array of module names.
 * @throws {Error} If the target process is not found, or if there's an error sending the message or receiving a response.
 */
async function listLogModules(pid) {
  const message = {
    type: 'list-log-modules',
  };

  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') {
      throw new Error(`Process with PID ${pid} not found.`);
    }
    throw new Error(`Failed to check process ${pid}: ${error.message}`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for module list from PID ${pid}. Ensure the target process is listening for 'list-log-modules' messages.`));
    }, 5000); // 5 second timeout

    const messageHandler = (msg, senderPid) => {
      if (senderPid === pid && msg && msg.type === 'log-modules-list') {
        clearTimeout(timeout);
        process.removeListener('message', messageHandler);
        if (Array.isArray(msg.payload)) {
          resolve(msg.payload);
        } else {
          reject(new Error(`Received invalid module list format from PID ${pid}. Expected an array.`));
        }
      }
    };

    process.on('message', messageHandler);

    try {
      process.send(message, pid);
    } catch (error) {
      clearTimeout(timeout);
      process.removeListener('message', messageHandler);
      reject(new Error(`Failed to send module list request to PID ${pid}: ${error.message}`));
    }
  });
}

export { changeLogLevel, listLogModules, isValidLogLevel };