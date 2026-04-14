#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description Command-Line Interface for the Basic Auth Obfuscator.
 *
 * This script provides 'encrypt' and 'decrypt' commands to manage basic
 * authentication credentials from the terminal. It uses 'yargs' for robust
* argument parsing and 'chalk' for user-friendly, colored output.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { encrypt, decrypt } from '../src/core.js';
import { SECRET_KEY_ENV_VAR } from '../src/constants.js';

/**
 * Prompts the user to enter a secret key securely without echoing it to the terminal.
 * This is crucial for preventing secret exposure in shell history.
 *
 * @param {string} promptMessage - The message to display to the user.
 * @returns {Promise<string>} A promise that resolves to the entered secret key.
 */
async function getSecretFromPrompt(promptMessage) {
  const rl = createInterface({ input, output });
  const secret = await rl.question(promptMessage, {
    // This is the key part for secure input: hide the typed characters.
    [Symbol.for('nodejs.readline.interface')]: {
      ...rl[Symbol.for('nodejs.readline.interface')],
      _writeToOutput: (stringToWrite) => {
        if (rl.line.length < stringToWrite.length) {
          rl.output.write(promptMessage);
        }
      },
    },
  });
  rl.close();
  // Add a newline to the console after the prompt is answered for clean formatting.
  process.stdout.write('\n');
  return secret.trim();
}

/**
 * Retrieves the secret key from the command-line arguments, environment variable,
 * or an interactive prompt, in that order of precedence.
 *
 * @param {object} argv - The parsed arguments from yargs.
 * @param {string} promptMessage - The message for the interactive prompt if needed.
 * @returns {Promise<string>} A promise that resolves to the secret key.
 * @throws {Error} If the secret key is empty or cannot be obtained.
 */
async function getSecretKey(argv, promptMessage) {
  // 1. Prioritize the --secret flag.
  if (argv.secret) {
    return argv.secret;
  }

  // 2. Check the environment variable.
  const secretFromEnv = process.env[SECRET_KEY_ENV_VAR];
  if (secretFromEnv) {
    console.log(chalk.dim(`Using secret from ${SECRET_KEY_ENV_VAR} environment variable.`));
    return secretFromEnv;
  }

  // 3. Fall back to an interactive prompt.
  console.log(chalk.yellow('Secret key not provided via --secret flag or environment variable.'));
  const secret = await getSecretFromPrompt(promptMessage);

  if (!secret) {
    throw new Error('Secret key cannot be empty. Aborting.');
  }
  return secret;
}

/**
 * Main function to set up and run the yargs-based CLI.
 */
async function main() {
  try {
    await yargs(hideBin(process.argv))
      .command(
        'encrypt <credentials>',
        'Encrypt a "user:pass" string into an opaque token.',
        (yargs) => {
          return yargs
            .positional('credentials', {
              describe: 'The "username:password" string to encrypt.',
              type: 'string',
            })
            .option('secret', {
              alias: 's',
              type: 'string',
              description: `The secret key for encryption. If not provided, uses ${SECRET_KEY_ENV_VAR} or prompts interactively.`,
              demandOption: false,
            });
        },
        async (argv) => {
          try {
            const secret = await getSecretKey(argv, chalk.cyan('Enter secret key for encryption: '));
            const token = await encrypt(argv.credentials, secret);

            console.log(chalk.green('\n✓ Encryption Successful!'));
            console.log(chalk.bold('\nGenerated Token:'));
            console.log(chalk.cyan(token));
            console.log(chalk.dim('\nStore this token in your configuration or environment variables.'));
          } catch (error) {
            console.error(chalk.red(`\n✗ Error during encryption: ${error.message}`));
            process.exit(1);
          }
        }
      )
      .command(
        'decrypt <token>',
        'Decrypt an opaque token back into a "user:pass" string.',
        (yargs) => {
          return yargs
            .positional('token', {
              describe: 'The encrypted token to decrypt.',
              type: 'string',
            })
            .option('secret', {
              alias: 's',
              type: 'string',
              description: `The secret key for decryption. If not provided, uses ${SECRET_KEY_ENV_VAR} or prompts interactively.`,
              demandOption: false,
            });
        },
        async (argv) => {
          try {
            const secret = await getSecretKey(argv, chalk.cyan('Enter secret key for decryption: '));
            const credentials = await decrypt(argv.token, secret);

            console.log(chalk.green('\n✓ Decryption Successful!'));
            console.log(chalk.bold('\nDecrypted Credentials:'));
            console.log(chalk.yellow(credentials));
          } catch (error) {
            console.error(chalk.red(`\n✗ Error during decryption: ${error.message}`));
            process.exit(1);
          }
        }
      )
      .demandCommand(1, 'You must provide a command: encrypt or decrypt.')
      .strict()
      .help()
      .alias('h', 'help')
      .version()
      .alias('v', 'version')
      .epilog(`For more information, visit the project repository.`)
      .wrap(yargs.terminalWidth())
      .parse();
  } catch (error) {
    // Catch-all for unexpected errors during CLI setup or execution.
    console.error(chalk.red(`\nAn unexpected error occurred: ${error.message}`));
    process.exit(1);
  }
}

// Execute the main CLI function.
main();