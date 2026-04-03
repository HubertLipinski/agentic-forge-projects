import nock from 'nock';
import chalk from 'chalk';
import { writeFixture, clearFixtures } from './utils/fixture-manager.js';
import { generateRequestHash } from './utils/hash-generator.js';

/**
 * @typedef {import('nock').Definition} NockDefinition
 * @typedef {import('./utils/hash-generator.js').RequestToHash} RequestToHash
 */

/**
 * @typedef {object} RecorderOptions
 * @property {string} fixturesDir - The directory to store fixture files.
 * @property {boolean} [clear] - Whether to clear existing fixtures before recording. Defaults to false.
 */

let isRecording = false;
let recordedDefinitions = [];

/**
 * Transforms a raw nock definition into a more structured format for hashing.
 * This is necessary because nock's definition object contains the full URL in `scope`,
 * and the path can sometimes be redundant. We need a clean `scope`, `path`, and `body`.
 *
 * @param {NockDefinition} nockDef - The raw definition captured by nock.
 * @returns {RequestToHash} A simplified request object suitable for hashing.
 */
function transformNockDefForHashing(nockDef) {
  const { scope, method, path, body } = nockDef;

  // The 'scope' from nock includes the full URL, but we only need the origin.
  // The 'path' includes the path and query string.
  const url = new URL(path, scope);

  return {
    scope: url.origin,
    method,
    path: `${url.pathname}${url.search}`,
    body,
  };
}

/**
 * The core handler function for nock's recorder.
 * This function is called for each intercepted HTTP request. It generates a unique
 * hash for the request and saves the nock definition as a JSON fixture.
 *
 * @param {NockDefinition} nockDef - The nock definition for the intercepted request.
 * @param {string} fixturesDir - The directory where fixtures should be saved.
 * @returns {Promise<void>}
 */
async function handleRecordedNockDef(nockDef, fixturesDir) {
  try {
    // Nock definitions are arrays, but `rec` provides them one by one.
    // We wrap it in an array to match the format nock expects for loading.
    const definitionToSave = [nockDef];
    recordedDefinitions.push(definitionToSave);

    const requestToHash = transformNockDefForHashing(nockDef);
    const filename = generateRequestHash(requestToHash);

    const filePath = await writeFixture(filename, definitionToSave, fixturesDir);
    console.log(
      chalk.green('[Recorder] ') +
      `Recorded: ${chalk.bold(`${nockDef.method} ${nockDef.path}`)} -> ${chalk.cyan(filePath)}`
    );
  } catch (error) {
    console.error(
      chalk.red('[Recorder] Error processing recorded request:'),
      error
    );
    // We don't re-throw here to allow the test suite to continue running,
    // but the error is logged to alert the user.
  }
}

/**
 * Starts the recording process.
 * It cleans up any previous nock state, optionally clears existing fixtures,
 * and sets up the nock recorder to capture outgoing HTTP requests.
 *
 * @param {RecorderOptions} options - Configuration for the recorder.
 * @returns {Promise<void>} A promise that resolves when recording has started.
 */
export async function startRecording({ fixturesDir, clear = false }) {
  if (isRecording) {
    console.warn(chalk.yellow('[Recorder] Recording is already in progress.'));
    return;
  }

  console.log(chalk.blue.bold('[Recorder] Starting in record mode...'));

  // Clean up any lingering nock interceptors or state
  nock.cleanAll();
  nock.restore();

  if (clear) {
    try {
      console.log(chalk.yellow(`[Recorder] Clearing existing fixtures from ${fixturesDir}...`));
      await clearFixtures(fixturesDir);
    } catch (error) {
      console.error(chalk.red(`[Recorder] Failed to clear fixtures: ${error.message}`));
      // Proceed even if clearing fails, but warn the user.
    }
  }

  recordedDefinitions = [];
  isRecording = true;

  // Configure and start nock's recorder
  nock.recorder.rec({
    // We handle output manually to control filename and format
    output_objects: true,
    // We don't need to log to console, we have our own logging
    dont_print: true,
    // This function will be called for each recorded request
    enable_reqheaders_recording: true, // Important for matching headers during replay
    logging: (content) => handleRecordedNockDef(content, fixturesDir),
  });

  console.log(chalk.gray('[Recorder] Nock recorder is active. Capturing outgoing HTTP requests.'));
}

/**
 * Stops the recording process.
 * It restores nock's original state, effectively disabling the interception
 * of HTTP requests. It also reports the total number of requests recorded.
 *
 * @returns {Promise<void>} A promise that resolves when recording has stopped.
 */
export async function stopRecording() {
  if (!isRecording) {
    return;
  }

  nock.recorder.restore();
  nock.cleanAll(); // Ensure all interceptors are removed
  isRecording = false;

  const totalRecorded = recordedDefinitions.length;
  console.log(
    chalk.blue.bold('[Recorder] Recording stopped. ') +
    `Total requests recorded: ${chalk.bold(totalRecorded)}`
  );
}