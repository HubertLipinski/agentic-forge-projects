/**
 * @fileoverview Main entry point for the Adaptive Scraper Cluster (ASC) command-line interface.
 *
 * This script uses the 'commander' library to define and manage the application's
 * command-line interface. It serves as the primary user interaction point for
 * starting cluster nodes (controller and worker) and for submitting new scraping jobs.
 *
 * It orchestrates the initialization of configuration and logging, then delegates
 * to the appropriate module based on the user's command.
 *
 * Tech Stack:
 * - commander: For parsing command-line arguments and defining the CLI structure.
 * - pino: For structured logging.
 * - ioredis: For communication with the Redis job queue.
 *
 * Commands:
 * - `asc controller`: Starts a controller node.
 * - `asc worker`: Starts a worker node.
 * - `asc submit <file>`: Submits a new scraping job or batch of jobs from a JSON file.
 *
 * @see {@link ../cluster/controller.js}
 * @see {@link ../cluster/worker.js}
 */

import { Command, Option } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../config/index.js';
import { validate, jobBatchSchema } from '../utils/ajv-schemas.js';
import { getRedisClient, ensureRedisConnected, disconnectRedis } from '../services/redis-client.js';

// Dynamically read package.json for version and description
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const { version, description } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

/**
 * Initializes shared services like logging and configuration.
 * This function is called before executing any command logic.
 *
 * @param {object} options - Command-line options.
 * @param {string} [options.config] - Path to a custom configuration file.
 */
async function initializeServices(options) {
  try {
    // 1. Load configuration from file and environment variables.
    // The path from the CLI option takes precedence.
    loadConfig(options.config);

    // 2. Initialize the logger with the loaded configuration.
    // This must happen after loadConfig() to respect logging settings.
    createLogger(loadConfig().logging);
  } catch (error) {
    // Use console.error because logger might not be initialized.
    console.error(`[FATAL] Failed to initialize application: ${error.message}`);
    process.exit(1);
  }
}

program
  .name('asc')
  .version(version)
  .description(description)
  .addOption(new Option('-c, --config <path>', 'Path to a custom configuration file (e.g., config.json)'))
  .hook('preAction', async (thisCommand, actionCommand) => {
    // The 'submit' command has its own initialization logic.
    if (actionCommand.name() !== 'submit') {
      await initializeServices(thisCommand.opts());
    }
  });

program
  .command('controller')
  .description('Starts a controller node to manage the scraping cluster.')
  .action(async () => {
    const logger = createLogger();
    logger.info(`Starting Adaptive Scraper Cluster Controller (v${version})...`);
    try {
      // Dynamically import the controller to avoid loading its dependencies
      // when running other commands (e.g., worker).
      const { startController } = await import('../cluster/controller.js');
      await startController();
    } catch (error) {
      logger.fatal({ err: error }, 'Failed to start the controller node.');
      process.exit(1);
    }
  });

program
  .command('worker')
  .description('Starts a worker node to execute scraping jobs.')
  .action(async () => {
    const logger = createLogger();
    logger.info(`Starting Adaptive Scraper Cluster Worker (v${version})...`);
    try {
      // Dynamically import the worker.
      const { startWorker } = await import('../cluster/worker.js');
      await startWorker();
    } catch (error) {
      logger.fatal({ err: error }, 'Failed to start the worker node.');
      process.exit(1);
    }
  });

program
  .command('submit')
  .description('Submits one or more scraping jobs from a JSON file to the Redis queue.')
  .argument('<file>', 'Path to the JSON file containing job definitions.')
  .action(async (filePath, options) => {
    // The 'submit' command needs its own minimal initialization.
    // It shares config path with the parent program.
    const parentOptions = program.opts();
    await initializeServices(parentOptions);
    const logger = createLogger();

    logger.info(`Submitting jobs from file: ${filePath}`);

    let jobs;
    try {
      const fileContent = readFileSync(path.resolve(filePath), 'utf-8');
      jobs = JSON.parse(fileContent);
    } catch (error) {
      logger.fatal({ err: error, file: filePath }, 'Failed to read or parse the job file.');
      process.exit(1);
    }

    // Ensure jobs is an array for consistent processing.
    const jobArray = Array.isArray(jobs) ? jobs : [jobs];

    // Validate the job batch against the schema.
    const { isValid, errors } = validate('asc/jobBatch', jobArray);
    if (!isValid) {
      logger.fatal({ errors, file: filePath }, 'Job definition file is invalid.');
      process.exit(1);
    }

    let redis;
    try {
      redis = getRedisClient();
      await ensureRedisConnected();
      const { redis: { keyPrefix = 'asc:' } } = loadConfig();
      const jobQueueKey = `${keyPrefix}jobs:pending`;

      const pipeline = redis.pipeline();
      let submittedCount = 0;
      for (const job of jobArray) {
        // Use job priority for the ZSET score. Higher priority = higher score.
        const priority = job.priority ?? 0;
        pipeline.zadd(jobQueueKey, priority, JSON.stringify(job));
        submittedCount++;
      }

      await pipeline.exec();
      logger.info(`Successfully submitted ${submittedCount} job(s) to the queue.`);
    } catch (error) {
      logger.fatal({ err: error }, 'Failed to connect to Redis or submit jobs.');
      process.exit(1);
    } finally {
      if (redis) {
        await disconnectRedis();
      }
    }
  });

/**
 * Main execution function for the CLI.
 * Parses command-line arguments and executes the corresponding command.
 */
export async function run() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Use console.error as logger might not be available.
    console.error(`An unexpected error occurred: ${error.message}`);
    process.exit(1);
  }
}