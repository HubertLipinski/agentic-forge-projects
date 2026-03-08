import chalk from 'chalk';
import ora from 'ora';

/**
 * @typedef {import('./state.js').EndpointState} EndpointState
 * @typedef {import('./config-loader.js').EndpointConfig} EndpointConfig
 */

// --- Color and Style Constants ---

const colors = {
  up: chalk.green,
  down: chalk.red,
  error: chalk.yellow,
  pending: chalk.gray,
  header: chalk.bold.cyan,
  label: chalk.gray,
  value: chalk.white,
  dim: chalk.dim,
  info: chalk.blue,
  success: chalk.green,
};

const symbols = {
  up: '✔',
  down: '✖',
  error: '⚠',
  pending: '…',
};

// --- Spinner Management ---

/** @type {Object.<string, ora.Ora>} */
const spinners = {};

/**
 * Creates and starts a spinner for a specific endpoint.
 * If a spinner for the endpoint already exists, it does nothing.
 *
 * @param {string} endpointName - The unique name of the endpoint.
 */
export function startSpinner(endpointName) {
  if (spinners[endpointName]) {
    return;
  }
  spinners[endpointName] = ora({
    text: `Probing ${endpointName}...`,
    spinner: 'dots',
    color: 'gray',
  }).start();
}

/**
 * Stops the spinner for a specific endpoint with a final message.
 *
 * @param {string} endpointName - The unique name of the endpoint.
 * @param {EndpointState} state - The final state of the endpoint after the probe.
 * @param {EndpointConfig} config - The configuration for the endpoint.
 */
export function stopSpinner(endpointName, state, config) {
  const spinner = spinners[endpointName];
  if (!spinner) {
    return;
  }

  const { lastStatus, lastResponseTime } = state;
  const color = colors[lastStatus.toLowerCase()] ?? colors.error;
  const symbol = symbols[lastStatus.toLowerCase()] ?? symbols.error;

  const statusText = chalk.bold(lastStatus);
  const urlText = colors.dim(`(${config.url})`);
  const timeText = lastResponseTime !== null ? ` in ${lastResponseTime}ms` : '';

  spinner.stopAndPersist({
    symbol: color(symbol),
    text: `${color(statusText)}: ${endpointName} ${urlText}${timeText}`,
  });

  delete spinners[endpointName];
}

/**
 * Stops all active spinners, typically used during graceful shutdown.
 *
 * @param {string} [message='Probes cancelled.'] - An optional message to display.
 */
export function stopAllSpinners(message = 'Probes cancelled.') {
  for (const endpointName in spinners) {
    if (Object.hasOwn(spinners, endpointName)) {
      spinners[endpointName].fail(message);
      delete spinners[endpointName];
    }
  }
}

// --- UI Rendering ---

/**
 * Clears the console screen.
 */
function clearConsole() {
  // This is a more robust way to clear the screen in different terminal environments.
  process.stdout.write('\x1B[2J\x1B[0f');
}

/**
 * Renders the main monitoring dashboard to the console.
 *
 * @param {Object.<string, EndpointState>} state - The current state of all endpoints.
 * @param {EndpointConfig[]} endpointsConfig - The configuration array for all endpoints.
 * @param {number} interval - The polling interval in seconds.
 */
export function renderDashboard(state, endpointsConfig, interval) {
  clearConsole();

  console.log(colors.header('Uptime Probe Dashboard'));
  console.log(colors.label(`Checking every ${interval} seconds. Press Ctrl+C to exit.`));
  console.log(''); // Spacer

  const tableHeader = [
    'Status'.padEnd(10),
    'Endpoint'.padEnd(25),
    'Availability'.padEnd(15),
    'Last Check'.padEnd(25),
    'Response Time'.padEnd(15),
  ].join('');
  console.log(colors.header(tableHeader));
  console.log(colors.header('-'.repeat(tableHeader.length)));

  if (endpointsConfig.length === 0) {
    console.log(colors.dim('No endpoints configured.'));
    return;
  }

  endpointsConfig.forEach(endpoint => {
    const endpointState = state[endpoint.name];
    if (!endpointState) return; // Should not happen with proper initialization

    const color = colors[endpointState.lastStatus.toLowerCase()] ?? colors.error;
    const symbol = symbols[endpointState.lastStatus.toLowerCase()] ?? symbols.error;

    const status = color(`${symbol} ${endpointState.lastStatus}`.padEnd(10));
    const name = endpoint.name.padEnd(25);
    const availability = `${endpointState.availability.toFixed(2)}%`.padEnd(15);

    const lastChecked =
      endpointState.lastChecked === 'N/A'
        ? 'N/A'.padEnd(25)
        : new Date(endpointState.lastChecked).toLocaleString().padEnd(25);

    const responseTime =
      endpointState.lastResponseTime === null
        ? 'N/A'.padEnd(15)
        : `${endpointState.lastResponseTime} ms`.padEnd(15);

    console.log(`${status}${name}${availability}${lastChecked}${responseTime}`);
  });

  console.log(''); // Spacer at the bottom
}

// --- Informational and Error Messages ---

/**
 * Displays a message indicating the start of the monitoring process.
 * @param {string} configPath - Path to the configuration file being used.
 */
export function showStartMessage(configPath) {
  console.log(colors.info(`\n🚀 Starting Uptime Probe...`));
  console.log(colors.dim(`   - Using config: ${configPath}`));
  console.log(colors.dim(`   - State will be persisted across runs.`));
  console.log(''); // Spacer
}

/**
 * Displays a message for graceful shutdown.
 */
export function showGoodbyeMessage() {
  console.log(colors.info('\n\n👋 Gracefully shutting down. Saving state...'));
}

/**
 * Displays a final confirmation message after state has been saved.
 */
export function showStateSavedMessage() {
  console.log(colors.success('State saved successfully. Goodbye!'));
}

/**
 * Displays a formatted error message and exits the process.
 *
 * @param {string|Error} message - The error message or Error object.
 * @param {boolean} [showUsage=false] - Whether to show a usage hint.
 */
export function showErrorAndExit(message, showUsage = false) {
  const errorMessage = message instanceof Error ? message.message : message;
  console.error(chalk.red.bold('\nError:'), chalk.red(errorMessage));

  if (showUsage) {
    console.log(chalk.cyan('\nUsage: uptime-probe --config <path/to/probe.yml>'));
  }

  process.exit(1);
}