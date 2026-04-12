#!/usr/bin/env node

/**
 * @file bin/run-tasks.js
 * @description The command-line interface (CLI) for the Concurrent Task Runner.
 * This script is responsible for:
 * - Parsing command-line arguments (e.g., path to the task file, concurrency).
 * - Loading and dynamically importing the user-defined task graph file.
 * - Setting up console-based logging by subscribing to logger events.
 * - Invoking the main orchestration logic from `src/index.js`.
 * - Handling top-level errors and setting the process exit code appropriately.
 */

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { run } from '../src/index.js';
import logger, { LogEvents } from '../src/utils/logger.js';

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
 * @param {boolean} verbose - If true, enables detailed 'verbose' event logging.
 */
function setupConsoleLogger(verbose) {
  const getFormattedTimestamp = () => colors.gray(`[${new Date().toLocaleTimeString()}]`);

  logger.on(LogEvents.ORCHESTRATION_START, ({ totalTasks, concurrency }) => {
    console.log(
      `${colors.magenta}${colors.bright}▶ Orchestration starting...${colors.reset}`
    );
    console.log(
      `${colors.dim}  Total tasks: ${totalTasks} | Concurrency: ${concurrency}${colors.reset}`
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
    console.error(colors.red(`  └─ ${error.stack || error.message}${colors.reset}`));
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
      `${colors.dim}Total: ${totalTasks}${colors.reset}`
    );
  });

  logger.on(LogEvents.ORCHESTRATION_ERROR, ({ error }) => {
    console.error(
      `\n${colors.red}${colors.bright}🚨 Critical Orchestration Error:${colors.reset}`
    );
    console.error(colors.red(error.stack || error.message));
  });

  if (verbose) {
    logger.on(LogEvents.VERBOSE, ({ message, ...data }) => {
      const dataString = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
      console.log(
        `${getFormattedTimestamp()} ${colors.cyan}VERBOSE${colors.reset}: ${message} ${colors.dim}${dataString}${colors.reset}`
      );
    });
  }
}

/**
 * Displays the help message for the CLI.
 */
function showHelp() {
  console.log(`
  ${colors.bright}Concurrent Task Runner${colors.reset}

  A dependency-aware task runner for Node.js.

  ${colors.bright}Usage:${colors.reset}
    run-tasks <file> [options]

  ${colors.bright}Arguments:${colors.reset}
    <file>              Path to the task definition file (e.g., tasks.js).

  ${colors.bright}Options:${colors.reset}
    -c, --concurrency   Maximum number of tasks to run in parallel.
                        (default: number of CPU cores)
    --no-bail           Continue running other tasks even if one fails.
                        (default: false, execution stops on first failure)
    -v, --verbose       Enable detailed verbose logging for debugging.
    -h, --help          Show this help message.
  `);
}

/**
 * Main entry point for the CLI application.
 */
async function main() {
  try {
    const { values, positionals } = parseArgs({
      options: {
        concurrency: {
          type: 'string',
          short: 'c',
        },
        bail: {
          type: 'boolean',
          default: true,
        },
        verbose: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
      allowPositionals: true,
    });

    if (values.help || positionals.length === 0) {
      showHelp();
      process.exit(0);
    }

    // --- Argument and File Handling ---
    const [taskFilePath] = positionals;
    const absoluteTaskFilePath = resolve(process.cwd(), taskFilePath);

    setupConsoleLogger(values.verbose);

    // Dynamically import the user's task file.
    // The `?t=${Date.now()}` cache-busting query is a trick to ensure
    // the latest version of the file is loaded, especially during development.
    const taskModule = await import(`${absoluteTaskFilePath}?t=${Date.now()}`);
    const taskDefinition = taskModule.default;

    if (!taskDefinition || typeof taskDefinition !== 'object') {
      throw new Error(
        `The task file at "${taskFilePath}" did not have a valid default export.`
      );
    }

    // --- Concurrency Configuration ---
    let concurrency;
    if (values.concurrency) {
      concurrency = parseInt(values.concurrency, 10);
      if (isNaN(concurrency) || concurrency < 1) {
        throw new Error(
          `Invalid concurrency value: "${values.concurrency}". Must be a positive integer.`
        );
      }
    } else {
      concurrency = cpus().length;
    }

    // --- Run Orchestration ---
    const { success } = await run(taskDefinition, {
      concurrency,
      bail: values.bail,
    });

    process.exit(success ? 0 : 1);
  } catch (error) {
    // Catch errors from file loading, argument parsing, or critical orchestrator failures.
    // Task-specific failures are handled by the logger and result in a non-zero exit code.
    if (!logger.listenerCount(LogEvents.ORCHESTRATION_ERROR)) {
      // Ensure critical errors are always printed, even if logger isn't set up.
      console.error(
        `\n${colors.red}${colors.bright}🚨 A critical error occurred:${colors.reset}`
      );
      console.error(colors.red(error.stack || error.message));
    }
    process.exit(1);
  }
}

// Execute the main function.
main();