/**
 * @file src/job.js
 * @description Defines the Job class, representing a single scheduled task.
 *
 * The Job class encapsulates all information and behavior related to a single
 * recurring task, including its unique ID, cron schedule, the task function
 * to execute, and its next scheduled run time. It also handles the logic for
 * calculating subsequent run times based on its schedule.
 */

import { parseExpression } from 'cron-parser';
import { v4 as uuidv4 } from 'uuid';
import { now } from './utils/time.js';

/**
 * Represents a single scheduled task within the scheduler.
 *
 * Each Job instance holds its configuration and state, such as its unique ID,
 * cron schedule, the async function to execute, and its next scheduled execution time.
 * It provides methods to update its schedule and to serialize its state for persistence.
 */
export class Job {
  /**
   * The unique identifier for the job.
   * @type {string}
   */
  id;

  /**
   * The cron pattern string that defines the job's schedule.
   * @type {string}
   */
  cronTime;

  /**
   * The asynchronous function to be executed when the job runs.
   * This property is not persisted and must be re-associated on application start.
   * @type {() => Promise<void>}
   */
  task;

  /**
   * The timestamp (in milliseconds since UNIX epoch) of the next scheduled run.
   * This value is calculated based on `cronTime` and the current time.
   * @type {number | null}
   */
  nextRun = null;

  /**
   * A cron-parser iterator instance for calculating run times.
   * @private
   * @type {import('cron-parser').CronDate}
   */
  #iterator;

  /**
   * Creates a new Job instance.
   *
   * @param {object} options - The job configuration.
   * @param {string} options.cronTime - The cron pattern for the schedule (e.g., '* * * * *').
   * @param {() => Promise<void>} options.task - The async function to execute.
   * @param {string} [options.id] - A unique ID for the job. If not provided, a v4 UUID will be generated.
   * @param {number} [options.nextRun] - The timestamp for the next run. If not provided, it's calculated from the cronTime.
   * @throws {Error} If `cronTime` is not a valid cron expression.
   * @throws {TypeError} If `task` is not a function.
   */
  constructor({ cronTime, task, id, nextRun }) {
    if (typeof task !== 'function') {
      throw new TypeError('Job `task` must be a function.');
    }

    this.id = id ?? uuidv4();
    this.cronTime = cronTime;
    this.task = task;

    // `parseExpression` throws an error on invalid cron syntax, providing validation.
    this.#iterator = parseExpression(this.cronTime, {
      currentDate: new Date(nextRun ?? now()),
    });

    // If nextRun is provided (e.g., from persisted state), use it.
    // Otherwise, calculate the next run time from the current time.
    if (nextRun) {
      // If the persisted nextRun is in the past, get the next valid run time from now.
      // This handles cases where the application was down.
      this.nextRun = nextRun >= now() ? nextRun : this.#iterator.next().getTime();
    } else {
      this.nextRun = this.#iterator.next().getTime();
    }
  }

  /**
   * Calculates and updates the `nextRun` property to the next scheduled time
   * after the current `nextRun`.
   *
   * @param {number} [from] - Optional timestamp to calculate the next run from.
   *   Defaults to the current `nextRun` time.
   */
  updateNextRun(from) {
    const baseDate = from ?? this.nextRun;
    if (baseDate === null) {
      // This should not happen in normal operation but is a safe fallback.
      this.#iterator.reset(new Date(now()));
    } else {
      this.#iterator.reset(new Date(baseDate));
    }
    this.nextRun = this.#iterator.next().getTime();
  }

  /**
   * Returns a serializable representation of the job's state.
   * The `task` function is intentionally omitted as it cannot be serialized.
   *
   * @returns {{id: string, cronTime: string, nextRun: number | null}}
   *   A plain object suitable for JSON serialization.
   */
  toJSON() {
    return {
      id: this.id,
      cronTime: this.cronTime,
      nextRun: this.nextRun,
    };
  }
}