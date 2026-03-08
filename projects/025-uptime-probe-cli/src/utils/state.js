import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * @typedef {object} EndpointState
 * @property {number} totalRequests - The total number of probes sent to this endpoint.
 * @property {number} successfulRequests - The number of successful (e.g., 2xx) probes.
 * @property {number} failedRequests - The number of failed probes.
 * @property {number} availability - The availability percentage (0-100).
 * @property {string} lastChecked - ISO 8601 timestamp of the last check.
 * @property {string} lastStatus - The status of the last check ('UP', 'DOWN', 'ERROR').
 * @property {number|null} lastResponseTime - The response time in ms of the last check.
 */

/**
 * @typedef {Object.<string, EndpointState>} MonitoringState
 */

const STATE_FILE_NAME = '.uptime-probe-state.json';
const STATE_FILE_PATH = path.join(os.homedir(), STATE_FILE_NAME);

/**
 * Loads the monitoring state from the JSON file in the user's home directory.
 * If the file doesn't exist or is invalid, it returns an empty object.
 *
 * @returns {Promise<MonitoringState>} The loaded monitoring state.
 */
export async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
    // Basic validation to ensure we're parsing a JSON object
    const state = JSON.parse(data);
    if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
      return state;
    }
    // If the file contains invalid JSON (e.g., just a string or number), start fresh.
    console.warn(`Warning: State file at ${STATE_FILE_PATH} contains invalid data. Starting with a fresh state.`);
    return {};
  } catch (error) {
    // If the file doesn't exist, that's a normal scenario for the first run.
    if (error.code === 'ENOENT') {
      return {};
    }
    // For other errors (e.g., permissions), log a warning and continue with an empty state.
    console.error(`Warning: Could not read state file at ${STATE_FILE_PATH}. Reason: ${error.message}`);
    console.error('The application will proceed with a temporary, in-memory state that will not be saved.');
    return {};
  }
}

/**
 * Saves the current monitoring state to the JSON file in the user's home directory.
 *
 * @param {MonitoringState} state - The monitoring state to save.
 * @returns {Promise<void>} A promise that resolves when the state is saved.
 */
export async function saveState(state) {
  try {
    // Use a temporary file and rename to ensure atomic write, preventing corruption
    // if the process is interrupted during the write operation.
    const tempFilePath = `${STATE_FILE_PATH}.${Date.now()}.tmp`;
    const stateJson = JSON.stringify(state, null, 2); // Pretty-print for readability

    await fs.writeFile(tempFilePath, stateJson, 'utf-8');
    await fs.rename(tempFilePath, STATE_FILE_PATH);
  } catch (error) {
    // Log an error but don't crash the application. State saving is non-critical.
    console.error(`\nError: Could not save state to ${STATE_FILE_PATH}. Reason: ${error.message}`);
  }
}

/**
 * Creates a default, initial state for a new endpoint.
 *
 * @returns {EndpointState} The default state object for an endpoint.
 */
export function createInitialEndpointState() {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    availability: 100.0,
    lastChecked: 'N/A',
    lastStatus: 'PENDING',
    lastResponseTime: null,
  };
}

/**
 * Updates the state for a specific endpoint based on a probe result.
 * This function is pure; it returns a new state object rather than mutating the input.
 *
 * @param {EndpointState} currentState - The current state of the endpoint.
 * @param {object} probeResult - The result from the probe.
 * @param {boolean} probeResult.isSuccess - Whether the probe was successful.
 * @param {number} probeResult.responseTime - The response time in milliseconds.
 * @param {string} probeResult.status - The resulting status ('UP' or 'DOWN').
 * @returns {EndpointState} The newly calculated state for the endpoint.
 */
export function updateEndpointState(currentState, probeResult) {
  const totalRequests = currentState.totalRequests + 1;
  const successfulRequests = currentState.successfulRequests + (probeResult.isSuccess ? 1 : 0);
  const failedRequests = totalRequests - successfulRequests;

  const availability = totalRequests > 0
    ? (successfulRequests / totalRequests) * 100
    : 100.0;

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    availability,
    lastChecked: new Date().toISOString(),
    lastStatus: probeResult.status,
    lastResponseTime: probeResult.responseTime,
  };
}