/**
 * @file src/utils/logger.js
 * @description A simple, event-based logger for emitting structured task lifecycle events.
 * This logger uses Node.js's EventEmitter to decouple logging from task execution.
 * Consumers can subscribe to specific events to implement custom logging logic,
 * such as writing to a file, sending to a service, or printing to the console.
 */

import { EventEmitter } from 'node:events';

/**
 * Enum-like object for standardizing log event names.
 * Using this ensures consistency when emitting and listening for events.
 * @readonly
 * @enum {string}
 */
export const LogEvents = {
  TASK_START: 'task:start',
  TASK_SUCCESS: 'task:success',
  TASK_FAIL: 'task:fail',
  TASK_SKIP: 'task:skip',
  ORCHESTRATION_START: 'orchestration:start',
  ORCHESTRATION_END: 'orchestration:end',
  ORCHESTRATION_ERROR: 'orchestration:error',
  VERBOSE: 'verbose',
};

/**
 * A singleton instance of EventEmitter used as the central event bus for logging.
 * By exporting a single instance, we ensure that all parts of the application
 * use the same event emitter, making it a global (within the module scope) pub/sub system.
 * @type {EventEmitter}
 */
const logger = new EventEmitter();

// Increase the max listeners to avoid warnings in complex graphs with many listeners.
// The default is 10, which might be too low if many components listen for logs.
logger.setMaxListeners(30);

/**
 * Emits a 'task:start' event.
 * @param {string} taskId - The unique identifier of the task that is starting.
 */
export function emitTaskStart(taskId) {
  logger.emit(LogEvents.TASK_START, { taskId, timestamp: new Date() });
}

/**
 * Emits a 'task:success' event.
 * @param {string} taskId - The unique identifier of the task that succeeded.
 * @param {number} durationMs - The execution time of the task in milliseconds.
 */
export function emitTaskSuccess(taskId, durationMs) {
  logger.emit(LogEvents.TASK_SUCCESS, {
    taskId,
    durationMs,
    timestamp: new Date(),
  });
}

/**
 * Emits a 'task:fail' event.
 * @param {string} taskId - The unique identifier of the task that failed.
 * @param {Error} error - The error object that caused the failure.
 * @param {number} durationMs - The execution time of the task until failure in milliseconds.
 */
export function emitTaskFail(taskId, error, durationMs) {
  logger.emit(LogEvents.TASK_FAIL, {
    taskId,
    error,
    durationMs,
    timestamp: new Date(),
  });
}

/**
 * Emits a 'task:skip' event.
 * @param {string} taskId - The unique identifier of the task that was skipped.
 * @param {string[]} failedDependencies - A list of dependency task IDs that failed, causing this task to be skipped.
 */
export function emitTaskSkip(taskId, failedDependencies) {
  logger.emit(LogEvents.TASK_SKIP, {
    taskId,
    reason: `Skipped due to failed dependencies: ${failedDependencies.join(', ')}`,
    failedDependencies,
    timestamp: new Date(),
  });
}

/**
 * Emits a 'verbose' event for detailed, non-critical logging.
 * Useful for debugging the orchestrator's internal state.
 * @param {string} message - The verbose log message.
 * @param {object} [data={}] - Optional additional data to include with the log.
 */
export function emitVerbose(message, data = {}) {
  logger.emit(LogEvents.VERBOSE, {
    message,
    ...data,
    timestamp: new Date(),
  });
}

/**
 * Emits an 'orchestration:start' event.
 * @param {number} totalTasks - The total number of tasks in the graph.
 * @param {number} concurrency - The configured concurrency limit.
 */
export function emitOrchestrationStart(totalTasks, concurrency) {
    logger.emit(LogEvents.ORCHESTRATION_START, {
        totalTasks,
        concurrency,
        timestamp: new Date(),
    });
}

/**
 * Emits an 'orchestration:end' event.
 * @param {object} summary - An object containing execution summary details.
 * @param {number} summary.totalTasks - Total tasks defined.
 * @param {number} summary.executedTasks - Number of tasks that were executed.
 * @param {number} summary.succeededTasks - Number of tasks that succeeded.
 * @param {number} summary.failedTasks - Number of tasks that failed.
 * @param {number} summary.skippedTasks - Number of tasks that were skipped.
 * @param {number} summary.totalDurationMs - Total orchestration time in milliseconds.
 */
export function emitOrchestrationEnd(summary) {
    logger.emit(LogEvents.ORCHESTRATION_END, {
        ...summary,
        timestamp: new Date(),
    });
}

/**
 * Emits an 'orchestration:error' event for critical, top-level errors.
 * @param {Error} error - The error that occurred during orchestration.
 */
export function emitOrchestrationError(error) {
    logger.emit(LogEvents.ORCHESTRATION_ERROR, {
        error,
        timestamp: new Date(),
    });
}


// Export the singleton logger instance directly.
// This allows other modules to attach listeners (e.g., `logger.on(...)`).
export default logger;