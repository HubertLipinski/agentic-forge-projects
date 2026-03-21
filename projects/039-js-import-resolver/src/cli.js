/**
 * @file src/cli.js
 * @description Main entry point for the command-line interface.
 * Configures yargs with commands, options, and help text for the JS Import Resolver tool.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pc from 'picocolors';

// Import command handlers
import { handler as scanHandler } from './commands/scan.js';
import { handler as fixHandler } from './commands/fix.js';

/**
 * Configures and runs the command-line interface using yargs.
 *
 * This function sets up the main command, its subcommands ('scan' and 'fix'),
 * and global options applicable to all commands. It also provides comprehensive
 * help text and examples to guide the user.
 *
 * @param {string[]} processArgs - The command-line arguments, typically `process.argv`.
 */
export function run(processArgs) {
  yargs(hideBin(processArgs))
    .scriptName('resolve-imports')
    .usage(`$0 <command> [options]`)
    .command(
      'scan [path]',
      'Analyze a project for broken ES module imports',
      (yargs) => {
        return yargs
          .positional('path', {
            describe: 'Path to the project directory to scan',
            type: 'string',
            default: '.',
          })
          .option('watch', {
            alias: 'w',
            describe: 'Watch files for changes and re-run analysis',
            type: 'boolean',
            default: false,
          })
          .example([
            ['$0 scan', 'Scan the current directory for broken imports.'],
            ['$0 scan ./src', 'Scan only the "src" directory.'],
            ['$0 scan --watch', 'Scan and enter watch mode to re-analyze on changes.'],
          ]);
      },
      scanHandler
    )
    .command(
      'fix [path]',
      'Find and fix broken ES module imports',
      (yargs) => {
        return yargs
          .positional('path', {
            describe: 'Path to the project directory to fix',
            type: 'string',
            default: '.',
          })
          .option('interactive', {
            alias: 'i',
            describe: 'Prompt for each fix individually',
            type: 'boolean',
            default: false,
          })
          .example([
            ['$0 fix', 'Automatically apply all safe fixes (those with one valid suggestion).'],
            ['$0 fix -i', 'Enter interactive mode to approve or reject each suggestion.'],
          ]);
      },
      fixHandler
    )
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose output for more detailed error reasons',
      type: 'boolean',
      global: true,
      default: false,
    })
    .demandCommand(1, pc.yellow('You must specify a command: scan or fix.'))
    .recommendCommands()
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('V', 'version')
    .epilogue(
      `For more information, find the documentation at ${pc.underline(
        'https://github.com/your-username/js-import-resolver'
      )}`
    )
    .strict()
    .fail((msg, err, yargs) => {
      // Custom failure handler to provide more user-friendly messages
      if (err) {
        // This catches internal yargs errors or errors from command handlers
        console.error(pc.red('\nAn unexpected error occurred:'));
        console.error(pc.red(err.stack || err.message));
        process.exit(1);
      } else {
        // This handles command validation errors (e.g., missing command, unknown option)
        console.error(pc.red(`\nError: ${msg}\n`));
        console.error(pc.gray('Use --help for a list of available commands and options.'));
        process.exit(1);
      }
    })
    .parse();
}