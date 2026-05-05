import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { generateReadme } from './engine.js';

/**
 * Custom error class for CLI-specific issues.
 */
class CliError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Optional parameters.
   * @param {Error} [options.cause] The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'CliError';
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

/**
 * Configures and runs the command-line interface using yargs.
 * It defines the available commands, options, and their descriptions,
 * and then invokes the core engine with the parsed arguments.
 *
 * @param {string[]} processArgs - The command-line arguments, typically from `process.argv`.
 * @returns {Promise<void>} A promise that resolves when the command has been executed, or rejects on error.
 */
export async function runCli(processArgs) {
  try {
    await yargs(hideBin(processArgs))
      .command(
        '$0', // This makes it the default command
        'Generate a README.md file by parsing your project structure.',
        (yargs) => {
          return yargs
            .option('template', {
              alias: 't',
              type: 'string',
              description: 'Path to a custom Mustache template or a built-in template name (default, compact).',
              default: 'default',
            })
            .option('entry', {
              alias: 'e',
              type: 'array',
              description: 'Glob patterns for source files to parse for JSDoc comments.',
              default: [],
            })
            .option('output', {
              alias: 'o',
              type: 'string',
              description: 'Path for the generated output file.',
              default: 'README.md',
            })
            .option('project-root', {
              alias: 'p',
              type: 'string',
              description: 'The root directory of the project to analyze.',
              default: process.cwd(),
              normalize: true, // Converts the path to an absolute path
            });
        },
        async (argv) => {
          // The handler function for the default command
          const options = {
            template: argv.template,
            entry: argv.entry,
            output: argv.output,
            projectRoot: argv.projectRoot,
          };

          await generateReadme(options);
        }
      )
      .alias('h', 'help')
      .alias('v', 'version')
      .epilogue('For more information, find our repository at https://github.com/your-username/auto-readme-generator')
      .demandCommand(0) // Allows the default command to run without any sub-command
      .strict() // Report errors for unknown options
      .fail((msg, err, yargs) => {
        // Custom failure handler to provide cleaner error messages
        if (err) {
          // Re-throw the original error to be caught by the outer try/catch block
          throw err;
        } else {
          // For yargs-specific errors (e.g., invalid options)
          console.error(`Error: ${msg}`);
          console.error(yargs.help());
          process.exit(1);
        }
      })
      .parse();
  } catch (error) {
    // This catches errors thrown from the command handler (generateReadme) or the fail handler.
    console.error('\n❌ An unexpected error occurred during README generation:\n');

    // Log the error chain for better debugging
    let currentError = error;
    let depth = 0;
    while (currentError) {
      const prefix = ' '.repeat(depth * 2);
      console.error(`${prefix}${currentError.name}: ${currentError.message}`);
      currentError = currentError.cause;
      depth++;
    }

    // For developers, uncomment the line below to see the full stack trace.
    // console.error('\n--- Full Stack Trace ---\n', error.stack);

    process.exit(1);
  }
}