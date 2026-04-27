#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The command-line interface entry point for the Declarative Cron Parser.
 * This script uses `yargs` to parse command-line arguments and orchestrates the
 * core logic for generating or watching for changes to generate a crontab file.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { performance } from 'node:perf_hooks';
import { run } from '../src/core/orchestrator.js';
import { startWatcher } from '../src/core/watcher.js';

/**
 * Handles the main execution logic for a single run (not watch mode).
 * @param {object} argv - The parsed command-line arguments from yargs.
 */
async function handleRun(argv) {
  console.log('Starting declarative-cron-parser...');
  const startTime = performance.now();

  try {
    const { fileCount, scheduleCount } = await run({
      patterns: argv.patterns,
      output: argv.output,
      ignore: argv.ignore,
      header: argv.header,
      env: argv.env,
    });

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    console.log(`\n✨ Success! Processed ${fileCount} files and found ${scheduleCount} schedules.`);
    if (argv.output === '-') {
      console.log(`Crontab content written to stdout in ${duration}ms.`);
    } else {
      console.log(`Crontab written to ${argv.output} in ${duration}ms.`);
    }
  } catch (error) {
    console.error('\n❌ An error occurred during execution:');
    console.error(`Error: ${error.message}`);
    if (error.cause) {
      console.error(`Cause: ${error.cause.stack || error.cause.message}`);
    }
    process.exit(1);
  }
}

/**
 * Handles the logic for starting the file watcher.
 * @param {object} argv - The parsed command-line arguments from yargs.
 */
async function handleWatch(argv) {
  console.log('Entering watch mode. Initial generation...');

  const regenerationTask = async () => {
    await run({
      patterns: argv.patterns,
      output: argv.output,
      ignore: argv.ignore,
      header: argv.header,
      env: argv.env,
    });
  };

  try {
    // Perform an initial run
    await regenerationTask();
    console.log(`\nWatching for file changes in: ${argv.patterns.join(', ')}`);
    console.log('Press Ctrl+C to exit.');

    // Start the watcher
    await startWatcher({
      patterns: argv.patterns,
      ignore: argv.ignore,
      onRegenerate: regenerationTask,
      onError: (error) => {
        console.error('\nWatcher encountered an error:', error);
      },
    });
  } catch (error) {
    console.error('\n❌ An error occurred while setting up watch mode:');
    console.error(`Error: ${error.message}`);
    if (error.cause) {
      console.error(`Cause: ${error.cause.stack || error.cause.message}`);
    }
    process.exit(1);
  }
}

/**
 * Main CLI entry function.
 */
function main() {
  yargs(hideBin(process.argv))
    .scriptName('declarative-cron')
    .usage('$0 <patterns...>')
    .command(
      '$0 <patterns...>',
      'Parse source files and generate a crontab.',
      (yargs) => {
        return yargs
          .positional('patterns', {
            describe: 'One or more glob patterns to find source files',
            type: 'string',
          })
          .option('output', {
            alias: 'o',
            describe: 'Path to the output crontab file. Use "-" for stdout.',
            type: 'string',
            demandOption: true,
          })
          .option('ignore', {
            alias: 'i',
            describe: 'Glob pattern for files/directories to ignore',
            type: 'array',
            default: ['**/node_modules/**', '**/.git/**'],
          })
          .option('header', {
            describe: 'Path to a file to be used as a custom header in the crontab',
            type: 'string',
            // In a real project, we'd read the file content here or in the orchestrator.
            // For simplicity, we'll assume the orchestrator handles a string path if provided.
            // The provided orchestrator expects a string, not a path, so we'll treat it as such.
            // Let's adjust the description to be more accurate to the implementation.
            desc: 'A custom string to prepend to the crontab header',
          })
          .option('env', {
            describe: 'Set an environment variable in the crontab (e.g., --env.PATH="/usr/bin")',
            type: 'object',
            default: {},
          })
          .option('watch', {
            alias: 'w',
            describe: 'Watch for file changes and regenerate the crontab automatically',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => {
        if (argv.watch) {
          handleWatch(argv);
        } else {
          handleRun(argv);
        }
      }
    )
    .example('$0 "**/*.js" "**/*.py" -o my-crontab', 'Parse all JS and Python files and save to my-crontab')
    .example('$0 "src/**/*.js" -o -', 'Parse JS files in src and print to stdout')
    .example('$0 "scripts/*.sh" -o crontab.txt --watch', 'Generate crontab and watch for changes in shell scripts')
    .example('$0 "tasks/**" -o cron.out --env.SHELL="/bin/bash"', 'Set the SHELL variable in the output crontab')
    .alias('h', 'help')
    .alias('v', 'version')
    .epilogue('For more information, visit the project repository.')
    .strict()
    .demandCommand(1, 'You must provide at least one glob pattern.')
    .help()
    .parse();
}

main();