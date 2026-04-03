import nock from 'nock';
import chalk from 'chalk';
import path from 'node:path';
import { loadAllFixtures } from './utils/fixture-manager.js';

/**
 * @typedef {import('nock').Definition} NockDefinition
 */

/**
 * @typedef {object} ReplayerOptions
 * @property {string} fixturesDir - The directory to load fixture files from.
 * @property {boolean} [allowUnmocked] - Whether to allow requests that don't have a matching mock.
 *                                       If false (default), unmocked requests will throw an error.
 */

let isReplaying = false;

/**
 * Activates nock interceptors based on the loaded fixture definitions.
 * This function defines the mocks that nock will use to intercept requests.
 *
 * @param {NockDefinition[]} nockDefs - An array of nock definitions loaded from fixture files.
 * @returns {number} The total number of scopes activated.
 */
function activateMocks(nockDefs) {
  if (!nockDefs || nockDefs.length === 0) {
    return 0;
  }

  // `nock.define` returns an array of the nock interceptor objects that were created.
  // Each definition file can contain multiple scopes (e.g., calls to different APIs).
  const scopes = nock.define(nockDefs);
  return scopes.length;
}

/**
 * Starts the replay process.
 * It cleans up any previous nock state, loads all fixtures from the specified
 * directory, and activates them as nock interceptors. It also configures
 * nock's behavior for unmocked requests.
 *
 * @param {ReplayerOptions} options - Configuration for the replayer.
 * @returns {Promise<void>} A promise that resolves when replaying has started.
 */
export async function startReplaying({ fixturesDir, allowUnmocked = false }) {
  if (isReplaying) {
    console.warn(chalk.yellow('[Replayer] Replay mode is already active.'));
    return;
  }

  console.log(chalk.blue.bold('[Replayer] Starting in replay mode...'));

  // Clean up any lingering nock interceptors or state before we begin.
  nock.cleanAll();
  nock.restore();

  let allNockDefs = [];
  try {
    console.log(chalk.gray(`[Replayer] Loading fixtures from: ${path.resolve(fixturesDir)}`));
    allNockDefs = await loadAllFixtures(fixturesDir);
  } catch (error) {
    // If loading fails (e.g., directory not found, permissions error), log and exit gracefully.
    // This is a critical failure for replay mode.
    console.error(
      chalk.red(`[Replayer] Critical error: Failed to load fixtures. Cannot proceed.`),
      error.message
    );
    // Exit with a non-zero code to indicate failure to the parent process (orchestrator).
    process.exit(1);
  }

  if (allNockDefs.length === 0) {
    console.warn(
      chalk.yellow('[Replayer] No fixture files found. All outgoing HTTP requests will be blocked unless `allowUnmocked` is true.')
    );
  }

  // Activate the loaded mocks.
  const activatedCount = activateMocks(allNockDefs);
  console.log(
    chalk.green('[Replayer] ') +
    `Activated ${chalk.bold(activatedCount)} mock definition(s).`
  );

  // By default, nock does not allow any real HTTP requests when it's active.
  // We can explicitly allow them if the user configures it.
  if (allowUnmocked) {
    nock.enableNetConnect();
    console.log(chalk.yellow('[Replayer] Unmocked requests are allowed to connect to the network.'));
  } else {
    // This is the default and safest behavior for deterministic tests.
    // It ensures no real network calls are made.
    nock.disableNetConnect();
    console.log(chalk.gray('[Replayer] Unmocked requests will be blocked.'));
  }

  isReplaying = true;
  console.log(chalk.gray('[Replayer] Nock is active. Intercepting HTTP requests based on fixtures.'));
}

/**
 * Stops the replay process.
 * It restores nock's original state, which removes all interceptors and
 * re-enables real network connections. This is crucial for cleanup after tests.
 *
 * @returns {Promise<void>} A promise that resolves when replaying has stopped.
 */
export async function stopReplaying() {
  if (!isReplaying) {
    return;
  }

  // Restore the original `http.request` and `https.request` modules.
  nock.restore();
  // Clean up any defined interceptors.
  nock.cleanAll();

  isReplaying = false;
  console.log(chalk.blue.bold('[Replayer] Replay mode stopped. Mocks have been deactivated.'));
}