import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {import('./mutant-generator.js').Mutant} Mutant
 */

/**
 * Represents the result of a single mutant test run.
 * @typedef {object} MutantTestResult
 * @property {Mutant} mutant - The mutant that was tested.
 * @property {string} status - The outcome of the test (e.g., 'Killed', 'Survived').
 * @property {string} [error] - An error message if the test run failed unexpectedly.
 */

// Resolve the path to the worker script. This is crucial for reliable worker creation.
// Using `import.meta.url` ensures the path is correct regardless of where the
// application is run from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_RUNNER_WORKER_PATH = path.resolve(__dirname, 'test-runner-worker.js');

/**
 * Manages the parallel execution of mutation tests using a pool of worker threads.
 *
 * This class is responsible for:
 * - Creating a fixed-size pool of workers.
 * - Distributing a queue of mutants among the available workers.
 * - Collecting results from each worker.
 * - Providing a simple `run` method to process all mutants and return the results.
 */
export class MutationEngine {
  /**
   * @param {object} config - The application configuration.
   * @param {number} [config.concurrency=os.cpus().length] - Number of parallel workers.
   * @param {string} config.testCommand - The command to run the test suite.
   * @param {number} config.timeout - Timeout for a single test run in ms.
   * @param {string} config.projectRoot - The root directory of the project being tested.
   */
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('MutationEngine requires a valid configuration object.');
    }
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.concurrency = config.concurrency ?? cpus().length;
  }

  /**
   * Executes the mutation testing process for a given list of mutants.
   *
   * It creates a queue of mutants and processes them using a pool of worker threads.
   * Each worker tests one mutant at a time. The method resolves when all mutants
   * have been tested.
   *
   * @param {Mutant[]} mutants - An array of mutants to be tested.
   * @param {object} [callbacks] - Optional callbacks for progress reporting.
   * @param {(mutant: Mutant) => void} [callbacks.onMutantTested] - Called after each mutant is tested.
   * @returns {Promise<MutantTestResult[]>} A promise that resolves to an array of test results.
   */
  async run(mutants, { onMutantTested = () => {} } = {}) {
    if (!Array.isArray(mutants) || mutants.length === 0) {
      return [];
    }

    const mutantQueue = [...mutants];
    const results = [];
    const workerPromises = [];

    // Create a pool of worker promises. Each promise represents the lifecycle
    // of a worker processing its share of the mutant queue.
    for (let i = 0; i < this.concurrency; i++) {
      workerPromises.push(this._workerTask(mutantQueue, results, onMutantTested));
    }

    // Wait for all workers to complete their tasks.
    await Promise.all(workerPromises);

    return results;
  }

  /**
   * The core task performed by each worker in the pool.
   *
   * A worker repeatedly pulls a mutant from the shared queue, tests it,
   * reports the result, and continues until the queue is empty.
   *
   * @param {Mutant[]} queue - The shared queue of mutants to test (mutated by this function).
   * @param {MutantTestResult[]} results - The shared array to store results.
   * @param {(mutant: Mutant, result: MutantTestResult) => void} onMutantTested - Progress callback.
   * @returns {Promise<void>} A promise that resolves when the worker has no more tasks.
   * @private
   */
  async _workerTask(queue, results, onMutantTested) {
    // The `while (true)` loop creates a persistent worker that keeps polling for tasks.
    while (true) {
      // `queue.shift()` is an atomic operation, making it safe for concurrent access
      // without needing explicit locks in this single-threaded Node.js context.
      const mutant = queue.shift();

      // If the queue is empty, the worker's job is done.
      if (!mutant) {
        return;
      }

      try {
        const result = await this._runTestInWorker(mutant);
        results.push(result);
        onMutantTested(mutant, result);
      } catch (error) {
        // This catch block handles catastrophic worker failures (e.g., script not found).
        const errorResult = {
          mutant,
          status: 'ERROR',
          error: `Worker failed for mutant ${mutant.id}: ${error.message}`,
        };
        results.push(errorResult);
        onMutantTested(mutant, errorResult);
      }
    }
  }

  /**
   * Creates a worker, sends it a single mutant to test, and waits for the result.
   *
   * This function encapsulates the `Worker` lifecycle for one mutant test:
   * 1. Create a new `Worker`.
   * 2. Pass the mutant data and configuration to it.
   * 3. Listen for a single 'message' (the result) or 'error'/'exit' events.
   * 4. Terminate the worker to ensure a clean state for the next test.
   *
   * @param {Mutant} mutant - The mutant to be tested.
   * @returns {Promise<MutantTestResult>} A promise that resolves with the test result for the mutant.
   * @private
   */
  _runTestInWorker(mutant) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(TEST_RUNNER_WORKER_PATH, {
        workerData: {
          mutant,
          config: this.config,
          projectRoot: this.projectRoot,
        },
        // It's safer to isolate each test run to prevent any potential state
        // leakage between runs, even though our worker is designed to be stateless.
        // This is a defense-in-depth measure.
        execArgv: [],
      });

      // Handler for the successful completion message from the worker.
      worker.on('message', (message) => {
        resolve({ mutant, ...message });
      });

      // Handler for unrecoverable errors in the worker script itself.
      worker.on('error', (err) => {
        reject(new Error(`Worker errored: ${err.message}`));
      });

      // Handler for unexpected worker exits.
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with non-zero exit code: ${code}`));
        }
      });
    });
  }
}