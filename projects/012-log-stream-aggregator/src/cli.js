/**
 * @file src/cli.js
 * @description The main CLI entry point using `yargs` to parse arguments for
 * file paths, TCP ports, and other configurations. It initializes and runs
 * the LogAggregator.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { LogAggregator } from './aggregator.js';

/**
 * Creates and configures the main pino logger for the application.
 * Logs are written to stderr to avoid mixing with the aggregated log output on stdout.
 *
 * @param {string} level - The minimum log level to output (e.g., 'info', 'debug').
 * @param {boolean} pretty - Whether to use pretty-printing for internal logs.
 * @returns {import('pino').Logger} A configured pino logger instance.
 */
function createLogger(level, pretty) {
  const destination = pino.destination({ fd: process.stderr.fd });
  const prettyStream = pretty ? pinoPretty({ destination }) : undefined;

  const logger = pino(
    {
      level,
      name: 'log-aggregator',
    },
    prettyStream ?? destination,
  );

  return logger;
}

/**
 * Sets up and runs the CLI application.
 * Parses command-line arguments, creates a logger, instantiates the LogAggregator,
 * and handles graceful shutdown.
 *
 * @param {string[]} argv - The command-line arguments array (e.g., `process.argv`).
 */
export async function run(argv) {
  const yargsInstance = yargs(hideBin(argv));

  const {
    file,
    tcp,
    stdin,
    'log-level': logLevel,
    'pretty-logs': prettyLogs,
  } = await yargsInstance
    .usage('Usage: $0 [options]')
    .option('f', {
      alias: 'file',
      describe: 'Path to a log file to tail. Can be specified multiple times.',
      type: 'array',
      string: true,
      default: [],
      normalize: true,
    })
    .option('t', {
      alias: 'tcp',
      describe: 'TCP port to listen on for logs. Can be specified multiple times.',
      type: 'array',
      number: true,
      default: [],
    })
    .option('s', {
      alias: 'stdin',
      describe: 'Read logs from stdin.',
      type: 'boolean',
      default: false,
    })
    .option('log-level', {
      describe: 'Set the internal logging level for the aggregator.',
      choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      default: 'info',
    })
    .option('pretty-logs', {
      describe: 'Enable pretty-printing for the aggregator\'s internal logs on stderr.',
      type: 'boolean',
      default: true,
    })
    .alias('h', 'help')
    .alias('v', 'version')
    .epilog(
      'Aggregates log streams from files, TCP, and stdin into a unified JSON output on stdout.\n' +
      'Internal application logs are written to stderr.\n\n' +
      'Example: log-aggregator -f /var/log/app.log -f /var/log/sys.log -t 3000 -s',
    )
    .fail((msg, err, yargs) => {
      // Custom failure handler to ensure clean exit
      console.error(`Error: ${msg}\n`);
      if (err) {
        console.error(err.stack || err.message);
      }
      console.error(yargs.help());
      process.exit(1);
    })
    .parseAsync();

  const logger = createLogger(logLevel, prettyLogs);

  if (file.length === 0 && tcp.length === 0 && !stdin) {
    logger.warn('No sources specified. The aggregator has nothing to do. Exiting.');
    logger.info('Use --help for usage information.');
    return;
  }

  let aggregator;
  try {
    aggregator = new LogAggregator({
      files: file,
      tcpPorts: tcp,
      stdin,
      logger,
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize the LogAggregator. Exiting.');
    process.exit(1);
  }

  /**
   * Handles graceful shutdown on SIGINT or SIGTERM.
   * @param {string} signal - The signal received (e.g., 'SIGINT').
   */
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await aggregator.stop();
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'An error occurred during shutdown.');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await aggregator.start();
  } catch (error) {
    logger.fatal({ err: error }, 'A fatal error occurred during aggregator startup. Exiting.');
    process.exit(1);
  }
}