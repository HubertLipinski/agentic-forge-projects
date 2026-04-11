/**
 * src/storage/db.js
 *
 * File-based database layer for the Job Queue Orchestrator.
 *
 * This module manages the persistence of job data in a JSON Lines file (`.jsonl`).
 * Each line in the file represents a job state change (e.g., creation, update).
 * This append-only log design ensures durability and provides a complete history
 * for auditing and recovery.
 *
 * On initialization, the module reads the entire job log file into memory to
 * reconstruct the current state of all jobs. This in-memory representation
 * allows for fast querying. New job state changes are appended to the log file
 * and then applied to the in-memory cache.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { appendLine, readFileContent } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

/**
 * A simple, file-based database for storing and retrieving job data.
 * It uses a JSON Lines file for durable, append-only storage and maintains
 * an in-memory cache for fast access.
 */
export class JobDb {
  /**
   * @type {string} The file path for the database.
   */
  #dbPath;

  /**
   * @type {Map<string, object>} In-memory cache of the latest state of each job.
   * The key is the job ID, and the value is the job object.
   */
  #jobCache;

  /**
   * @type {boolean} A flag to indicate if the database has been initialized.
   */
  #isInitialized = false;

  /**
   * @type {Promise<void> | null} A promise that resolves when initialization is complete.
   * Used to queue operations until the DB is ready.
   */
  #initPromise = null;

  /**
   * Creates an instance of the JobDb.
   * @param {string} dbPath - The path to the database file (e.g., 'data/jobs.db.jsonl').
   */
  constructor(dbPath) {
    if (!dbPath) {
      throw new Error('Database path must be provided.');
    }
    this.#dbPath = dbPath;
    this.#jobCache = new Map();
  }

  /**
   * Initializes the database by loading all jobs from the file into memory.
   * This method reconstructs the current state of each job by processing the
   * entire append-only log. It's designed to be called only once.
   *
   * @returns {Promise<void>} A promise that resolves when the database is loaded.
   */
  initialize() {
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = (async () => {
      logger.info({ path: this.#dbPath }, 'Initializing database...');
      try {
        // Check if the file exists by attempting to read it.
        // readFileContent returns '' for non-existent files, which is fine.
        const content = await readFileContent(this.#dbPath);
        if (content.trim() === '') {
          logger.info({ path: this.#dbPath }, 'Database file is empty or does not exist. Starting fresh.');
          this.#isInitialized = true;
          return;
        }

        const fileStream = createReadStream(this.#dbPath);
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        let lineCount = 0;
        for await (const line of rl) {
          if (line.trim() === '') continue; // Skip empty lines

          try {
            const job = JSON.parse(line);
            // The log contains the history. We only care about the latest state for the cache.
            // The last entry for a given job ID in the file wins.
            if (job && job.id) {
              this.#jobCache.set(job.id, job);
              lineCount++;
            } else {
              logger.warn({ line }, 'Skipping invalid line in DB file: missing or invalid JSON.');
            }
          } catch (parseError) {
            logger.error({ err: parseError, line }, 'Failed to parse line from DB file. Line skipped.');
          }
        }

        this.#isInitialized = true;
        logger.info(
          {
            path: this.#dbPath,
            lineCount,
            jobCount: this.#jobCache.size,
          },
          'Database initialization complete.'
        );
      } catch (error) {
        logger.fatal({ err: error, path: this.#dbPath }, 'Failed to initialize database. The application may not function correctly.');
        // Re-throw to prevent the application from starting in a broken state.
        throw new Error(`Fatal error during database initialization: ${error.message}`);
      }
    })();

    return this.#initPromise;
  }

  /**
   * Ensures that the database is initialized before proceeding.
   * @private
   */
  async #ensureInitialized() {
    if (!this.#initPromise) {
      // This case should ideally not be hit if initialize() is called at startup.
      logger.warn('Database accessed before explicit initialization. Initializing now.');
      await this.initialize();
    }
    await this.#initPromise;
  }

  /**
   * Appends a job record to the database file and updates the in-memory cache.
   * This is the primary method for persisting new jobs or job state updates.
   *
   * @param {object} job - The job object to persist. Must be serializable.
   * @returns {Promise<void>} A promise that resolves when the job is persisted.
   * @throws {Error} If the job object is invalid or persistence fails.
   */
  async append(job) {
    await this.#ensureInitialized();

    if (!job || typeof job !== 'object' || !job.id) {
      throw new Error('Invalid job object provided for persistence.');
    }

    try {
      const jobString = JSON.stringify(job);
      await appendLine(this.#dbPath, jobString);
      // Update the in-memory cache with the latest version of the job.
      this.#jobCache.set(job.id, job);
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'Failed to append job to database.');
      // The cache might be out of sync with the file, but we prioritize
      // not crashing the app. The next restart will recover the state from disk.
      throw new Error(`Failed to persist job ${job.id}: ${error.message}`);
    }
  }

  /**
   * Retrieves a single job by its ID from the in-memory cache.
   *
   * @param {string} jobId - The ID of the job to retrieve.
   * @returns {Promise<object | undefined>} The job object, or undefined if not found.
   */
  async findById(jobId) {
    await this.#ensureInitialized();
    const job = this.#jobCache.get(jobId);
    // Return a deep copy to prevent accidental mutation of the cached object.
    return job ? structuredClone(job) : undefined;
  }

  /**
   * Retrieves all jobs from the in-memory cache.
   *
   * @returns {Promise<Array<object>>} An array of all job objects.
   */
  async findAll() {
    await this.#ensureInitialized();
    // Return a deep copy of all jobs.
    return Array.from(this.#jobCache.values()).map(job => structuredClone(job));
  }
}