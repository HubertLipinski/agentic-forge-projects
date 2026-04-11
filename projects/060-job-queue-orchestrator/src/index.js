/**
 * src/index.js
 *
 * Main application entry point for the Job Queue Orchestrator.
 *
 * This file is responsible for initializing all core services, setting up the
 * Fastify server, and managing the application's lifecycle, including graceful
 * shutdown. It wires together the configuration, database, queue, scheduler,
 * and API server to create a fully functional application.
 */

import config from '../config/default.js';
import logger from './utils/logger.js';
import { JobDb } from './storage/db.js';
import { JobQueue } from './services/queue.js';
import { Scheduler } from './services/scheduler.js';
import { createServer } from './api/server.js';

// --- Global State ---
// These variables hold the core components of the application.
// They are initialized in main() and used in the shutdown handler.
let db;
let queue;
let scheduler;
let server;

/**
 * The main function that orchestrates the application startup.
 * It initializes services in the correct order:
 * 1. Database: Must be ready before the queue can access it.
 * 2. Job Queue: The central state manager for jobs.
 * 3. Scheduler: Depends on the queue to find and execute jobs.
 * 4. API Server: Depends on the queue to handle API requests.
 *
 * @returns {Promise<void>} A promise that resolves when the server starts, or rejects on fatal error.
 */
async function main() {
  logger.info('Starting Job Queue Orchestrator...');

  // 1. Initialize Database
  db = new JobDb(config.storagePath);
  await db.initialize();

  // 2. Initialize Job Queue Service
  queue = new JobQueue({ db, config });

  // 3. Initialize Scheduler
  scheduler = new Scheduler({ queue, config });

  // 4. Initialize and start the Fastify server
  server = createServer({ queue, logger, config });
  await server.listen({ port: config.port, host: '0.0.0.0' });

  // 5. Start the scheduler after the server is up and running.
  // This ensures the system is ready to accept API calls before it starts
  // processing background jobs.
  scheduler.start();

  logger.info(`Server listening on http://0.0.0.0:${config.port}`);
  logger.info('Application startup complete. Waiting for jobs...');
}

/**
 * Handles graceful shutdown of the application.
 * It ensures that services are stopped in the correct order to prevent
 * data loss or corruption.
 *
 * @param {string} signal - The signal that triggered the shutdown (e.g., 'SIGINT').
 */
async function gracefulShutdown(signal) {
  if (!server && !scheduler) {
    // If services are not initialized, just exit.
    logger.info('Application not fully started, exiting immediately.');
    process.exit(0);
  }

  logger.info({ signal }, 'Shutdown signal received. Starting graceful shutdown...');

  try {
    // 1. Stop the scheduler first to prevent it from starting new jobs.
    // We give it a timeout to allow running jobs to finish.
    if (scheduler) {
      await scheduler.stop(config.shutdownTimeout);
    }

    // 2. Close the server to stop accepting new API requests.
    if (server) {
      await server.close();
      logger.info('HTTP server closed.');
    }

    logger.info('Graceful shutdown complete. Exiting.');
    process.exit(0);
  } catch (error) {
    logger.fatal({ err: error }, 'Graceful shutdown failed. Forcing exit.');
    process.exit(1);
  }
}

// --- Process Event Handlers ---

// Listen for termination signals to trigger graceful shutdown.
// 'SIGINT' is typically sent by Ctrl+C.
// 'SIGTERM' is a generic termination signal sent by process managers (e.g., Docker, systemd).
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled promise rejections to prevent the application from crashing.
// This is a safety net; ideally, all promises should be handled.
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ err: reason, promise }, 'Unhandled Promise Rejection detected. This is a critical error and may leave the application in an unstable state.');
  // In a real production environment, you might want to trigger a graceful shutdown here
  // and restart the process, as the application state is now unknown.
  // For now, we log it as fatal.
});

// Catch uncaught exceptions. This is the last line of defense.
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception detected. The application will now exit.');
  // It's not safe to continue after an uncaught exception. Attempt a quick shutdown.
  gracefulShutdown('uncaughtException').catch(() => {
    process.exit(1); // Force exit if shutdown fails
  });
});

// --- Application Entry Point ---
// Execute the main function and handle any top-level errors.
main().catch((error) => {
  logger.fatal({ err: error }, 'Application failed to start.');
  process.exit(1);
});