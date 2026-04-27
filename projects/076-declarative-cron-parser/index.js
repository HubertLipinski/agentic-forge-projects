/**
 * @file index.js
 * @description Main entry point for the declarative-cron-parser module.
 * This file exports the core functionalities of the library, allowing it to be
 * used programmatically in other Node.js projects, in addition to its CLI.
 *
 * This enables developers to integrate cron generation directly into their build
 * scripts, testing frameworks, or other automation tools.
 *
 * @module declarative-cron-parser
 * @exports run
 * @exports startWatcher
 * @exports buildCrontab
 * @exports extractSchedulesFromFile
 * @exports extractSchedulesFromFileContent
 * @exports isValidCron
 */

// Core Orchestration
import { run } from './src/core/orchestrator.js';
import { startWatcher } from './src/core/watcher.js';

// Generators
import { buildCrontab } from './src/generators/crontab-builder.js';

// Parsers
import {
  extractSchedulesFromFile,
  extractSchedulesFromFileContent,
} from './src/parsers/comment-extractor.js';

// Utilities
import { isValidCron } from './src/utils/cron-validator.js';

/**
 * @typedef {import('./src/parsers/comment-extractor.js').CronSchedule} CronSchedule
 * The primary data structure representing a parsed cron job.
 */

export {
  /**
   * The main orchestration function. It finds files, extracts schedules,
   * builds the crontab string, and writes it to the specified output.
   * Ideal for single-run generation, such as in a CI/CD pipeline.
   * @type {import('./src/core/orchestrator.js').run}
   */
  run,

  /**
   * Creates and manages a file watcher that triggers a regeneration callback
   * on file system events. Useful for local development environments to keep
   * the crontab continuously synchronized.
   * @type {import('./src/core/watcher.js').startWatcher}
   */
  startWatcher,

  /**
   * Builds a complete crontab file as a string from a set of schedules and
   * configuration options. This function provides direct access to the
   * generation logic, useful for custom integrations.
   * @type {import('./src/generators/crontab-builder.js').buildCrontab}
   */
  buildCrontab,

  /**
   * Reads a file and extracts all cron schedule directives from its content.
   * A convenience function that combines file reading and parsing.
   * @type {import('./src/parsers/comment-extractor.js').extractSchedulesFromFile}
   */
  extractSchedulesFromFile,

  /**
   * Extracts all valid cron schedule directives from a string of file content.
   * This allows for parsing content that may not be on the filesystem.
   * @type {import('./src/parsers/comment-extractor.js').extractSchedulesFromFileContent}
   */
  extractSchedulesFromFileContent,

  /**
   * Validates a standard 5-part cron expression string.
   * A lightweight utility for checking cron syntax before processing.
   * @type {import('./src/utils/cron-validator.js').isValidCron}
   */
  isValidCron,
};

// Default export for convenience, if desired by consumers.
// For example: `import declarativeCron from 'declarative-cron-parser'; declarativeCron.run(...)`
export default {
  run,
  startWatcher,
  buildCrontab,
  extractSchedulesFromFile,
  extractSchedulesFromFileContent,
  isValidCron,
};