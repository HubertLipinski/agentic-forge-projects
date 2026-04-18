/**
 * @fileoverview Defines the command-line interface (CLI) for the Config Snapshot Tester.
 *
 * This module uses 'yargs' to create a user-friendly CLI with commands for testing,
 * generating, and updating configuration snapshots. It serves as the main entry point
 * for user interaction, orchestrating calls to the programmatic API and presenting
 * results in a readable format on the console.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import path from 'node:path';
import { testSnapshot, generateSnapshot } from './api.js';

// --- Helper Functions for CLI Output ---

/**
 * Formats and prints the results of a snapshot test to the console.
 * @param {import('./api.js').TestResult} result - The result object from `testSnapshot`.
 * @param {string} filePath - The original file path provided by the user.
 */
function printTestResult(result, filePath) {
  const relativePath = path.relative(process.cwd(), result.configFilePath);

  if (!result.snapshotExists) {
    console.error(chalk.red.bold('FAIL ') + chalk.white(relativePath));
    console.error(chalk.red(`  \u203A Snapshot not found.`));
    console.error(chalk.yellow(`    Run \`config-snap generate ${filePath}\` to create one.`));
    return;
  }

  if (result.areEqual) {
    console.log(chalk.green.bold('PASS ') + chalk.white(relativePath));
    return;
  }

  console.error(chalk.red.bold('FAIL ') + chalk.white(relativePath));
  console.error(chalk.red(`  \u203A Snapshot test failed.`));

  result.diffs.forEach(diff => {
    switch (diff.type) {
      case 'added':
        console.log(chalk.green(`    + Added:   '${diff.path}' (type: ${diff.actual})`));
        break;
      case 'removed':
        console.log(chalk.red(`    - Removed: '${diff.path}' (expected type: ${diff.expected})`));
        break;
      case 'type-changed':
        console.log(chalk.yellow(`    \u2195 Changed: '${diff.path}'`));
        console.log(chalk.red(`      - Expected: ${diff.expected}`));
        console.log(chalk.green(`      + Received: ${diff.actual}`));
        break;
    }
  });

  console.log(chalk.yellow(`\n  Run \`config-snap update ${filePath}\` to accept the changes.`));
}

/**
 * Formats and prints the results of a snapshot generation/update to the console.
 * @param {import('./api.js').GenerateResult} result - The result object from `generateSnapshot`.
 */
function printGenerateResult(result) {
  const relativePath = path.relative(process.cwd(), result.snapshotPath);
  if (result.isNew) {
    console.log(chalk.green('Snapshot created: ') + chalk.white(relativePath));
  } else {
    console.log(chalk.yellow('Snapshot updated: ') + chalk.white(relativePath));
  }
}

/**
 * A shared handler for commands that operate on a file path. It provides
 * consistent error handling and calls the provided action function.
 * @param {string} commandName - The name of the command for error messages.
 * @param {(argv: { filePath: string, ignore?: string[] }) => Promise<void>} action - The async action to perform.
 * @returns {(argv: { filePath: string, ignore?: string[] }) => Promise<void>} The yargs command handler.
 */
function fileCommandHandler(commandName, action) {
  return async (argv) => {
    try {
      await action(argv);
    } catch (error) {
      console.error(chalk.red.bold(`\nError during '${commandName}' command for "${argv.filePath}":`));
      console.error(chalk.red(error.message));
      // Set a non-zero exit code to indicate failure, crucial for CI environments.
      process.exitCode = 1;
    }
  };
}

// --- Yargs Command Definitions ---

/**
 * Defines the 'test' command for comparing a config file against its snapshot.
 */
const testCommand = {
  command: 'test <filePath>',
  describe: 'Compare a configuration file against its snapshot',
  builder: (y) => {
    return y.positional('filePath', {
      describe: 'Path to the configuration file (e.g., config.json, .env)',
      type: 'string',
      normalize: true,
    }).option('ignore', {
      alias: 'i',
      describe: 'Dot-notation paths to ignore during comparison (e.g., "db.password")',
      type: 'array',
      string: true,
      default: [],
    });
  },
  handler: fileCommandHandler('test', async (argv) => {
    const result = await testSnapshot(argv.filePath, { ignore: argv.ignore });
    printTestResult(result, argv.filePath);
    if (!result.areEqual) {
      process.exitCode = 1;
    }
  }),
};

/**
 * Defines the 'generate' command for creating a new snapshot.
 */
const generateCommand = {
  command: 'generate <filePath>',
  describe: 'Generate a new snapshot for a configuration file',
  builder: (y) => {
    return y.positional('filePath', {
      describe: 'Path to the configuration file to snapshot',
      type: 'string',
      normalize: true,
    });
  },
  handler: fileCommandHandler('generate', async (argv) => {
    const result = await generateSnapshot(argv.filePath);
    printGenerateResult(result);
  }),
};

/**
 * Defines the 'update' command, an alias for 'generate' for updating existing snapshots.
 */
const updateCommand = {
  command: 'update <filePath>',
  describe: 'Update an existing snapshot to match the current configuration',
  builder: (y) => {
    return y.positional('filePath', {
      describe: 'Path to the configuration file whose snapshot needs updating',
      type: 'string',
      normalize: true,
    });
  },
  handler: fileCommandHandler('update', async (argv) => {
    const result = await generateSnapshot(argv.filePath);
    printGenerateResult(result);
  }),
};

/**
 * The main function to configure and run the yargs CLI.
 * It sets up all commands, options, and help messages.
 */
export function runCli() {
  yargs(hideBin(process.argv))
    .command(testCommand)
    .command(generateCommand)
    .command(updateCommand)
    .demandCommand(1, 'You need to specify a command (test, generate, or update).')
    .strict()
    .alias({ h: 'help', v: 'version' })
    .epilogue('For more information, visit the project repository.')
    .fail((msg, err, yargs) => {
      // Custom failure handler for better error messages
      if (err) {
        // This handles exceptions during command execution
        console.error(chalk.red.bold('An unexpected error occurred:'));
        console.error(chalk.red(err.message));
        if (process.env.NODE_ENV === 'development' && err.stack) {
          console.error(err.stack);
        }
      } else {
        // This handles yargs-specific validation errors (e.g., missing command/argument)
        console.error(chalk.red(msg));
        console.error(`\nRun ${chalk.cyan('config-snap --help')} for a list of available commands.`);
      }
      process.exit(1);
    })
    .parse();
}