/**
 * @file src/core/syncer.js
 * @description Implements file watching and synchronization logic.
 *
 * This module uses 'chokidar' to monitor a source file for changes. When a
 * change is detected, it triggers the appropriate conversion process and
 * updates the destination file, enabling real-time synchronization between
 * .env and INI configuration files. It's designed to be robust, handling
 * file system events gracefully and preventing infinite loops by ignoring
 * changes to the destination file.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chokidar from 'chokidar';
import { parseIniFile, stringifyIniFile } from '../parsers/ini-parser.js';
import { parseEnvFile, stringifyEnvFile } from '../parsers/env-parser.js';
import { convertIniToEnv, convertEnvToIni } from './converter.js';

/**
 * Determines the conversion direction based on file extensions.
 *
 * @param {string} sourcePath - The path to the source file.
 * @param {string} destPath - The path to the destination file.
 * @returns {'ini-to-env' | 'env-to-ini'} The conversion direction.
 * @throws {Error} If file extensions are ambiguous or unsupported.
 */
function getConversionDirection(sourcePath, destPath) {
  const isSourceIni = sourcePath.endsWith('.ini');
  const isDestEnv = destPath.endsWith('.env');
  const isSourceEnv = sourcePath.endsWith('.env');
  const isDestIni = destPath.endsWith('.ini');

  if (isSourceIni && isDestEnv) {
    return 'ini-to-env';
  }
  if (isSourceEnv && isDestIni) {
    return 'env-to-ini';
  }

  // Handle ambiguous cases
  if (isSourceIni && isDestIni) {
    throw new Error('Ambiguous conversion: Both source and destination are .ini files.');
  }
  if (isSourceEnv && isDestEnv) {
    throw new Error('Ambiguous conversion: Both source and destination are .env files.');
  }

  throw new Error(
    `Unsupported file combination: from "${sourcePath}" to "${destPath}". Please use .ini and .env files.`
  );
}

/**
 * Performs a single, one-time synchronization from a source file to a destination file.
 * This function encapsulates the full logic of reading, converting, and writing.
 *
 * @param {string} sourcePath - The path to the source file.
 * @param {string} destPath - The path to the destination file.
 * @param {object} options - Conversion options (e.g., caseType, prefixDelimiter).
 * @returns {Promise<void>} A promise that resolves when the sync is complete.
 */
export async function performSync(sourcePath, destPath, options) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found at "${sourcePath}".`);
  }

  const direction = getConversionDirection(sourcePath, destPath);

  try {
    if (direction === 'ini-to-env') {
      const iniData = await parseIniFile(sourcePath);
      const envData = convertIniToEnv(iniData, options);
      await stringifyEnvFile(destPath, envData);
    } else { // direction === 'env-to-ini'
      const envData = await parseEnvFile(sourcePath);
      const iniData = convertEnvToIni(envData, options);
      await stringifyIniFile(destPath, iniData);
    }
    console.log(`✅ Successfully synced "${sourcePath}" to "${destPath}".`);
  } catch (error) {
    // Log the error but don't crash the process, especially in watch mode.
    console.error(`❌ Sync failed: ${error.message}`);
    // In a non-watch context, we might want to re-throw or exit, but
    // for a syncer, logging is often the desired behavior.
  }
}

/**
 * Starts the file watcher to continuously synchronize files.
 *
 * It sets up a chokidar watcher on the source file. On any change, it triggers
 * the `performSync` function. It intelligently ignores initial 'add' events
 * (unless configured otherwise) and changes to the destination file to prevent
 * infinite loops.
 *
 * @param {string} sourcePath - The path to the source file to watch.
 * @param {string} destPath - The path to the destination file to update.
 * @param {object} options - Conversion and watcher options.
 * @param {boolean} [options.syncOnStart=true] - Whether to perform an initial sync when the watcher starts.
 * @returns {Promise<chokidar.FSWatcher>} A promise that resolves with the watcher instance.
 */
export async function startWatcher(sourcePath, destPath, options) {
  const { syncOnStart = true, ...converterOptions } = options;
  const absoluteSourcePath = resolve(sourcePath);
  const absoluteDestPath = resolve(destPath);

  console.log(`👁️  Watching for changes on "${sourcePath}"...`);

  // Perform an initial sync if requested.
  if (syncOnStart) {
    console.log('Performing initial synchronization...');
    await performSync(sourcePath, destPath, converterOptions);
  }

  const watcher = chokidar.watch(absoluteSourcePath, {
    persistent: true,
    ignoreInitial: true, // We handle the initial sync manually.
    // Ignore changes to the destination file to prevent sync loops.
    ignored: (path) => path === absoluteDestPath,
  });

  const handleChange = async (event, path) => {
    console.log(`\n🔄 File change detected (${event}): "${path}"`);
    await performSync(sourcePath, destPath, converterOptions);
  };

  watcher
    .on('add', (path) => handleChange('add', path))
    .on('change', (path) => handleChange('change', path))
    .on('error', (error) => console.error(`Watcher error: ${error.message}`))
    .on('ready', () => {
      console.log('Watcher is ready. Press Ctrl+C to stop.');
    });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down watcher...');
    watcher.close().then(() => {
      console.log('Watcher closed.');
      process.exit(0);
    });
  });

  return watcher;
}