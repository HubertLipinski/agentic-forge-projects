import chokidar from 'chokidar';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * @typedef {object} WatcherOptions
 * @property {string[]} watchPatterns - An array of glob patterns for files to watch.
 * @property {string[]} command - The test command and its arguments to execute (e.g., ['mocha', 'test.js']).
 * @property {string} fixturesDir - Directory for storing fixtures.
 * @property {string[]} cliArgs - The original CLI arguments to pass to the spawned process.
 */

// State to manage the currently running test process
let activeTestProcess = null;

/**
 * Kills the currently active test process, if one exists.
 * Sends a SIGTERM signal to gracefully terminate the process.
 */
function killActiveProcess() {
  if (activeTestProcess && !activeTestProcess.killed) {
    console.log(chalk.yellow('[Watcher] Stopping active test run...'));
    // Use SIGTERM for a graceful shutdown, allowing the child to clean up.
    // The 'exit' event of the child process will handle the rest.
    activeTestProcess.kill('SIGTERM');
    activeTestProcess = null;
  }
}

/**
 * Spawns the http-mock-recorder CLI in record mode as a child process.
 * This function is called whenever a watched file changes. It ensures that
 * any previously running test process is terminated before starting a new one.
 *
 * @param {WatcherOptions} options - The configuration for the watcher and the command to run.
 */
function triggerRecordRun({ command, fixturesDir, cliArgs }) {
  // If a test is already running, kill it before starting a new one.
  killActiveProcess();

  console.log(chalk.blue.bold('\n[Watcher] File change detected. Triggering re-record...'));

  // We need to spawn the main CLI script of our own tool.
  // This ensures that the full recording setup (via orchestrator) is executed.
  const cliScriptPath = path.resolve(process.cwd(), 'bin/http-mock-recorder.js');

  // Construct the arguments for the child process.
  // We force '--record' and '--clear' for a clean re-recording session.
  // We also pass along the original test command.
  const spawnArgs = [
    '--record',
    '--clear', // Always clear fixtures on a re-run for consistency
    ...cliArgs, // Pass through original args like --fixtures-dir
    '--',
    ...command,
  ];

  console.log(
    chalk.gray(`[Watcher] Spawning: node ${path.basename(cliScriptPath)} ${spawnArgs.join(' ')}`)
  );

  activeTestProcess = spawn('node', [cliScriptPath, ...spawnArgs], {
    stdio: 'inherit', // Pipe output directly to the user's console
    shell: process.platform === 'win32',
  });

  activeTestProcess.on('error', (err) => {
    console.error(
      chalk.red.bold('[Watcher] Failed to start the recorder process:'),
      err
    );
    activeTestProcess = null;
  });

  activeTestProcess.on('exit', (code, signal) => {
    if (signal === 'SIGTERM') {
      console.log(chalk.yellow('[Watcher] Previous test run terminated.'));
    } else if (code === 0) {
      console.log(chalk.green.bold('[Watcher] Record run completed successfully.'));
    } else {
      console.error(
        chalk.red.bold(`[Watcher] Record run failed with exit code ${code}.`)
      );
    }
    console.log(chalk.gray('[Watcher] Waiting for new file changes...'));
    activeTestProcess = null;
  });
}

/**
 * Initializes and starts the file watcher using chokidar.
 * It sets up listeners for file changes and triggers the recording process.
 *
 * @param {WatcherOptions} options - Configuration for the watcher.
 * @returns {Promise<void>} A promise that resolves when the watcher is ready.
 */
export function startWatcher(options) {
  const { watchPatterns, command } = options;

  if (!watchPatterns || watchPatterns.length === 0) {
    console.error(chalk.red('[Watcher] No watch patterns specified. Use the --watch flag with file globs.'));
    console.error(chalk.yellow('Example: http-mock-recorder --watch "src/**/*.js" -- jest'));
    process.exit(1);
  }

  if (!command || command.length === 0) {
    console.error(chalk.red('[Watcher] No test command provided to run.'));
    console.error(chalk.yellow('Example: http-mock-recorder --watch "src/**/*.js" -- jest'));
    process.exit(1);
  }

  console.log(chalk.cyan.bold('[Watcher] Starting in watch mode...'));
  console.log(chalk.gray(`[Watcher] Watching patterns: ${watchPatterns.join(', ')}`));

  const watcher = chokidar.watch(watchPatterns, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't trigger on initial scan
  });

  // A simple debounce mechanism to prevent rapid-fire triggers
  let isReady = false;
  let debounceTimer = null;

  const debouncedTrigger = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Only trigger if the watcher is fully initialized
      if (isReady) {
        triggerRecordRun(options);
      }
    }, 200); // 200ms debounce delay
  };

  watcher
    .on('ready', () => {
      isReady = true;
      console.log(chalk.green('[Watcher] Initial scan complete. Ready for changes.'));
      // Trigger an initial run so the user has a baseline
      triggerRecordRun(options);
    })
    .on('add', (filePath) => {
      console.log(chalk.gray(`[Watcher] File added: ${filePath}`));
      debouncedTrigger();
    })
    .on('change', (filePath) => {
      console.log(chalk.gray(`[Watcher] File changed: ${filePath}`));
      debouncedTrigger();
    })
    .on('unlink', (filePath) => {
      console.log(chalk.gray(`[Watcher] File removed: ${filePath}`));
      debouncedTrigger();
    })
    .on('error', (error) => {
      console.error(chalk.red(`[Watcher] An error occurred: ${error}`));
    });

  // Gracefully handle process exit
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      console.log(chalk.blue('\n[Watcher] Shutting down...'));
      killActiveProcess();
      watcher.close().then(() => {
        console.log(chalk.gray('[Watcher] Watcher closed.'));
        process.exit(0);
      });
    });
  });
}