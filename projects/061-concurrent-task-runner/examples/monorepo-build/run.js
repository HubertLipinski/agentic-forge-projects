/**
 * @file examples/monorepo-build/run.js
 * @description A script to programmatically execute the monorepo build example.
 * This file serves as a demonstration of how to use the concurrent task runner
 * as a library within another Node.js script, rather than using the CLI.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../src/index.js';
import logger, { LogEvents } from '../../src/utils/logger.js';
import taskGraphDefinition from './tasks.js';

// --- ANSI Color Codes for Console Output ---
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Attaches listeners to the global logger to print formatted output to the console.
 * This provides a rich, color-coded view of the task execution process.
 */
function setupConsoleLogger() {
  const getFormattedTimestamp = () => colors.gray(`[${new Date().toLocaleTimeString()}]`);

  logger.on(LogEvents.ORCHESTRATION_START, ({ totalTasks, concurrency }) => {
    console.log(
      `\n${colors.magenta}${colors.bright}▶ Monorepo Build Orchestration Starting...${colors.reset}`
    );
    console.log(
      `${colors.dim}  Total tasks: ${totalTasks} | Concurrency: ${concurrency}${colors.reset}\n`
    );
  });

  logger.on(LogEvents.TASK_START, ({ taskId }) => {
    console.log(
      `${getFormattedTimestamp()} ${colors.blue}▶ RUNNING${colors.reset} ${taskId}`
    );
  });

  logger.on(LogEvents.TASK_SUCCESS, ({ taskId, durationMs }) => {
    const duration =
      durationMs > 1000
        ? `${(durationMs / 1000).toFixed(2)}s`
        : `${Math.round(durationMs)}ms`;
    console.log(
      `${getFormattedTimestamp()} ${colors.green}✔ SUCCESS${colors.reset} ${taskId} ${colors.dim}(${duration})${colors.reset}`
    );
  });

  logger.on(LogEvents.TASK_FAIL, ({ taskId, error, durationMs }) => {
    const duration =
      durationMs > 1000
        ? `${(durationMs / 1000).toFixed(2)}s`
        : `${Math.round(durationMs)}ms`;
    console.error(
      `${getFormattedTimestamp()} ${colors.red}✖ FAILED ${colors.reset} ${taskId} ${colors.dim}(${duration})${colors.reset}`
    );
    // Use optional chaining for safety, though error should always be an Error instance.
    console.error(colors.red(`  └─ ${error?.stack || error?.message}${colors.reset}`));
  });

  logger.on(LogEvents.TASK_SKIP, ({ taskId, reason }) => {
    console.log(
      `${getFormattedTimestamp()} ${colors.yellow}─ SKIPPED${colors.reset} ${taskId} ${colors.dim}(${reason})${colors.reset}`
    );
  });

  logger.on(LogEvents.ORCHESTRATION_END, ({ summary }) => {
    const {
      succeededTasks,
      failedTasks,
      skippedTasks,
      totalTasks,
      totalDurationMs,
    } = summary;

    const totalDuration = (totalDurationMs / 1000).toFixed(2);
    const statusColor = failedTasks > 0 ? colors.red : colors.green;

    console.log(`\n${statusColor}${colors.bright}🏁 Orchestration finished in ${totalDuration}s.${colors.reset}`);
    console.log(
      `   ${colors.green}✔ Succeeded: ${succeededTasks}${colors.reset} | ` +
      `${colors.red}✖ Failed: ${failedTasks}${colors.reset} | ` +
      `${colors.yellow}─ Skipped: ${skippedTasks}${colors.reset} | ` +
      `${colors.dim}Total: ${totalTasks}${colors.reset}\n`
    );
  });

  logger.on(LogEvents.ORCHESTRATION_ERROR, ({ error }) => {
    console.error(
      `\n${colors.red}${colors.bright}🚨 Critical Orchestration Error:${colors.reset}`
    );
    console.error(colors.red(error.stack || error.message));
  });
}

/**
 * The main execution function for this example script.
 */
async function main() {
  // Set up the console logger to subscribe to events from the task runner.
  setupConsoleLogger();

  try {
    // Define the options for the run.
    // We'll use a concurrency of 4 for this example, and keep `bail` enabled (the default),
    // which means the run will stop scheduling new tasks after the first failure.
    const options = {
      concurrency: 4,
      bail: true,
    };

    // Invoke the main `run` function from the library, passing the imported
    // task graph definition and the configured options.
    const { success, summary } = await run(taskGraphDefinition, options);

    // The script will exit with a code of 0 if all tasks succeeded, and 1 otherwise.
    // This is useful for integration into CI/CD pipelines.
    console.log(`Execution ${success ? 'succeeded' : 'failed'}. Exiting.`);
    process.exit(success ? 0 : 1);

  } catch (error) {
    // This catch block will handle critical errors thrown during the setup phase,
    // such as a validation error in the task graph (e.g., a cycle).
    // Task execution errors are handled within the orchestrator and reported
    // via the logger and the final result object.
    if (!logger.listenerCount(LogEvents.ORCHESTRATION_ERROR)) {
      // Fallback in case the logger wasn't set up.
      console.error(`${colors.red}A critical error occurred during setup:${colors.reset}`);
      console.error(error);
    }
    process.exit(1);
  }
}

// Start the execution.
main();