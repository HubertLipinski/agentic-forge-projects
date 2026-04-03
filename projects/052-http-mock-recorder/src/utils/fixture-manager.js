import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/**
 * @typedef {import('nock').Definition} NockDefinition
 */

const DEFAULT_FIXTURES_DIR = '__http_mocks__';
const FIXTURE_EXTENSION = '.json';

/**
 * Ensures that the specified directory exists. If it doesn't, it's created.
 *
 * @param {string} dirPath - The absolute path to the directory.
 * @returns {Promise<void>} A promise that resolves when the directory is ready.
 * @throws {Error} If the directory cannot be created.
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore EEXIST error, which means the directory already exists.
    if (error.code !== 'EEXIST') {
      console.error(`[FixtureManager] Failed to create directory: ${dirPath}`);
      throw error; // Re-throw other errors
    }
  }
}

/**
 * Constructs the full path for a fixture file.
 *
 * @param {string} filename - The base name of the fixture file (without extension).
 * @param {string} [fixturesDir=DEFAULT_FIXTURES_DIR] - The directory to store fixtures in.
 * @returns {string} The absolute path to the fixture file.
 */
function getFixturePath(filename, fixturesDir = DEFAULT_FIXTURES_DIR) {
  if (!filename) {
    throw new Error('[FixtureManager] A filename is required to generate a fixture path.');
  }
  const absoluteDir = path.resolve(process.cwd(), fixturesDir);
  return path.join(absoluteDir, `${filename}${FIXTURE_EXTENSION}`);
}

/**
 * Writes a nock definition to a JSON file.
 * The file is pretty-printed with 2-space indentation for readability.
 *
 * @param {string} filename - The base name for the fixture file.
 * @param {NockDefinition} nockDef - The nock definition object to save.
 * @param {string} [fixturesDir=DEFAULT_FIXTURES_DIR] - The directory where fixtures are stored.
 * @returns {Promise<string>} A promise that resolves with the full path of the written file.
 * @throws {Error} If the file cannot be written.
 */
export async function writeFixture(filename, nockDef, fixturesDir = DEFAULT_FIXTURES_DIR) {
  const filePath = getFixturePath(filename, fixturesDir);
  const dirPath = path.dirname(filePath);

  try {
    await ensureDirectoryExists(dirPath);
    const jsonContent = JSON.stringify(nockDef, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
    return filePath;
  } catch (error) {
    console.error(`[FixtureManager] Error writing fixture to ${filePath}:`, error);
    throw new Error(`Failed to write fixture file: ${filePath}`);
  }
}

/**
 * Reads and parses a single JSON fixture file.
 *
 * @param {string} filePath - The absolute path to the fixture file.
 * @returns {Promise<NockDefinition>} A promise that resolves with the parsed nock definition.
 * @throws {Error} If the file cannot be read or parsed.
 */
async function readFixtureFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`[FixtureManager] Error reading or parsing fixture ${filePath}:`, error);
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in fixture file: ${filePath}`);
    }
    throw new Error(`Failed to read fixture file: ${filePath}`);
  }
}

/**
 * Scans a directory for all fixture files (`.json`) and loads them.
 *
 * @param {string} [fixturesDir=DEFAULT_FIXTURES_DIR] - The directory to scan for fixtures.
 * @returns {Promise<NockDefinition[]>} A promise that resolves with an array of all loaded nock definitions.
 */
export async function loadAllFixtures(fixturesDir = DEFAULT_FIXTURES_DIR) {
  const absoluteDir = path.resolve(process.cwd(), fixturesDir);
  const pattern = path.join(absoluteDir, `**/*${FIXTURE_EXTENSION}`);

  try {
    const fixtureFiles = await glob(pattern, { nodir: true });
    if (fixtureFiles.length === 0) {
      return [];
    }

    const readPromises = fixtureFiles.map(readFixtureFile);
    const allNockDefs = await Promise.all(readPromises);

    // Nock definitions are arrays of scopes, so we flatten them.
    return allNockDefs.flat();
  } catch (error) {
    console.error(`[FixtureManager] Error loading fixtures from ${absoluteDir}:`, error);
    // The underlying functions already throw specific errors, so we can re-throw.
    throw error;
  }
}

/**
 * Deletes all fixture files within the specified directory.
 *
 * @param {string} [fixturesDir=DEFAULT_FIXTURES_DIR] - The directory containing fixtures to be cleared.
 * @returns {Promise<void>} A promise that resolves when all fixtures have been deleted.
 * @throws {Error} If the directory cannot be read or files cannot be deleted.
 */
export async function clearFixtures(fixturesDir = DEFAULT_FIXTURES_DIR) {
  const absoluteDir = path.resolve(process.cwd(), fixturesDir);
  const pattern = path.join(absoluteDir, `**/*${FIXTURE_EXTENSION}`);

  try {
    const fixtureFiles = await glob(pattern, { nodir: true });
    if (fixtureFiles.length === 0) {
      // Nothing to do, resolve successfully.
      return;
    }

    const deletePromises = fixtureFiles.map(file => fs.unlink(file));
    await Promise.all(deletePromises);
    console.log(`[FixtureManager] Cleared ${fixtureFiles.length} fixture(s) from ${absoluteDir}`);
  } catch (error) {
    // ENOENT means the directory doesn't exist, which is fine.
    if (error.code === 'ENOENT') {
      return;
    }
    console.error(`[FixtureManager] Error clearing fixtures in ${absoluteDir}:`, error);
    throw new Error(`Failed to clear fixtures from directory: ${absoluteDir}`);
  }
}