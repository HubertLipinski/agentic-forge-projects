import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { run } from './orchestrator.js';
import { startWatcher } from './watcher.js';

const DEFAULT_FIXTURES_DIR = '__http_mocks__';

/**
 * Sets up and runs the yargs-based command-line interface.
 * It defines the available commands and options, and then executes the
 * appropriate logic based on the user's input.
 *
 * @param {string[]} argv - The process arguments, typically `process.argv`.
 * @returns {Promise<void>}
 */
export async function main(argv) {
  try {
    await yargs(hideBin(argv))
      .scriptName('http-mock-recorder')
      .usage(`Usage: $0 [options] -- <test-runner-command>`)
      .epilogue(
        'For more information, visit https://github.com/your-username/http-mock-recorder'
      )
      .command(
        '$0 [test-command...]',
        'Run the test command in replay (default) or record mode.',
        (yargs) => {
          return yargs
            .positional('test-command', {
              describe: 'The test command to execute (e.g., jest, mocha, npm test)',
              type: 'string',
            })
            .option('record', {
              alias: 'r',
              type: 'boolean',
              description: 'Run in record mode, capturing HTTP requests to fixtures.',
              conflicts: ['watch'], // Cannot record and watch simultaneously in this command
            })
            .option('watch', {
              alias: 'w',
              type: 'string',
              // Use `array: true` to support multiple --watch flags
              array: true,
              description: 'Run in watch mode. Re-records fixtures when specified source files (glob) change.',
              conflicts: ['record'],
            })
            .option('fixtures-dir', {
              alias: 'd',
              type: 'string',
              default: DEFAULT_FIXTURES_DIR,
              description: 'Directory to store/load HTTP fixtures.',
            })
            .option('allow-unmocked', {
              alias: 'u',
              type: 'boolean',
              default: false,
              description: 'In replay mode, allow unmocked requests to pass through to the network.',
            })
            .option('clear', {
              alias: 'c',
              type: 'boolean',
              default: false,
              description: 'In record mode, delete all existing fixtures before recording new ones.',
            })
            .example(
              '$0 jest',
              'Run jest in replay mode (the default).'
            )
            .example(
              '$0 --record -- mocha "tests/**/*.test.js"',
              'Run mocha in record mode.'
            )
            .example(
              '$0 --watch "src/**/*.js" --watch "lib/**/*.js" -- npm test',
              'Re-record on changes to src/ or lib/ files by running `npm test`.'
            );
        },
        async (argv) => {
          const {
            record,
            watch,
            fixturesDir,
            allowUnmocked,
            clear,
            'test-command': testCommand,
          } = argv;

          if (!testCommand || testCommand.length === 0) {
            console.error(chalk.red.bold('Error: No test command provided.'));
            console.error(chalk.yellow('Please specify a command to run after the options, separated by -- if needed.'));
            console.error(chalk.cyan('Example: http-mock-recorder jest'));
            process.exit(1);
          }

          if (watch && watch.length > 0) {
            // Watch mode has its own logic handled by the watcher module.
            // It will spawn the recorder process itself.
            const cliArgs = [];
            if (fixturesDir !== DEFAULT_FIXTURES_DIR) {
              cliArgs.push('--fixtures-dir', fixturesDir);
            }
            // Note: other flags like 'allowUnmocked' are not relevant for watch mode,
            // as it always runs in a clean-recording state.

            await startWatcher({
              watchPatterns: watch,
              command: testCommand,
              fixturesDir,
              cliArgs,
            });
          } else {
            // Orchestrator mode (standard record or replay).
            const mode = record ? 'record' : 'replay';
            await run({
              mode,
              command: testCommand,
              fixturesDir,
              allowUnmocked,
              clearFixtures: clear,
            });
          }
        }
      )
      .help()
      .alias('h', 'help')
      .version()
      .alias('v', 'version')
      .strict() // Show help if an unknown option is used
      .demandCommand(1, 'You must provide a test command to run.')
      .fail((msg, err, yargs) => {
        // Custom failure handler for better error messages
        if (err) {
          // Preserve stack trace for actual errors
          console.error(chalk.red.bold('An unexpected error occurred:'));
          console.error(err);
        } else {
          console.error(chalk.red.bold('Error:'), chalk.red(msg));
          console.error(chalk.yellow('\nRun with --help for usage information.'));
        }
        process.exit(1);
      })
      .parse();
  } catch (error) {
    console.error(
      chalk.red.bold('\n[CLI] A critical error occurred during initialization.')
    );
    console.error(error);
    process.exit(1);
  }
}