import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { performance } from 'node:perf_hooks';

import { loadConfig } from '../util/config-loader.js';
import { collectAllFiles } from '../util/file-collector.js';
import { generateMutantsForFile } from '../core/mutant-generator.js';
import { MutationEngine } from '../core/mutation-engine.js';
import { reportSummary } from '../reporters/summary-reporter.js';
import { availableMutators } from '../mutators/index.js';

/**
 * @typedef {import('../core/mutant-generator.js').Mutant} Mutant
 */

/**
 * Main application class that orchestrates the mutation testing process.
 */
class MutationTesterApp {
  /**
   * @param {object} config - The merged configuration object.
   */
  constructor(config) {
    this.config = config;
    this.spinner = ora();
  }

  /**
   * Executes the main mutation testing workflow.
   * This involves file collection, mutant generation, and running tests.
   */
  async run() {
    const startTime = performance.now();
    console.log(pc.cyan('Starting mutation testing...'));

    try {
      // 1. Collect files
      this.spinner.start('Collecting source and test files...');
      const { sourceFiles, testFiles, durationMs } = await collectAllFiles(this.config);
      this.spinner.succeed(`Collected ${sourceFiles.length} source file(s) and ${testFiles.length} test file(s) in ${durationMs}ms.`);

      if (sourceFiles.length === 0) {
        this.spinner.warn('No source files found to mutate. Check your `sourceFiles` configuration.');
        return;
      }
      if (testFiles.length === 0) {
        this.spinner.warn('No test files found. Mutation testing requires a test suite to run.');
        return;
      }

      // 2. Generate mutants
      this.spinner.start('Generating mutants...');
      const allMutants = await this.generateAllMutants(sourceFiles);
      if (allMutants.length === 0) {
        this.spinner.warn('No mutants were generated. Your code might not contain any mutable patterns, or the enabled mutators don\'t apply.');
        return;
      }
      this.spinner.succeed(`Generated ${allMutants.length} mutant(s).`);

      // 3. Run mutation tests
      const results = await this.runTests(allMutants);

      // 4. Report results
      await reportSummary(results, allMutants.length, this.config);

      const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✨ Done in ${totalDuration}s.`);

    } catch (error) {
      this.spinner.fail('An unexpected error occurred.');
      console.error(pc.red(error.stack || error.message));
      process.exitCode = 1;
    }
  }

  /**
   * Generates mutants for a list of source files.
   * @param {string[]} sourceFiles - A list of absolute paths to source files.
   * @returns {Promise<Mutant[]>} A promise that resolves to an array of all generated mutants.
   */
  async generateAllMutants(sourceFiles) {
    const enabledMutators = availableMutators.filter(m =>
      this.config.mutators.includes(m.name)
    );

    if (enabledMutators.length === 0) {
      this.spinner.warn('No mutators enabled. Check your configuration.');
      return [];
    }

    const mutantPromises = sourceFiles.map(file =>
      generateMutantsForFile(file, enabledMutators)
    );

    const mutantsByFile = await Promise.all(mutantPromises);
    return mutantsByFile.flat();
  }

  /**
   * Runs the test suite against each generated mutant using the MutationEngine.
   * @param {Mutant[]} mutants - The list of all mutants to test.
   * @returns {Promise<import('../core/mutation-engine.js').MutantTestResult[]>} A promise that resolves to an array of test results.
   */
  async runTests(mutants) {
    const engine = new MutationEngine({ ...this.config, projectRoot: process.cwd() });
    const totalMutants = mutants.length;
    let testedCount = 0;

    this.spinner.start(`Testing mutants (0/${totalMutants})...`);

    const onMutantTested = () => {
      testedCount++;
      this.spinner.text = `Testing mutants (${testedCount}/${totalMutants})...`;
    };

    const results = await engine.run(mutants, { onMutantTested });
    this.spinner.succeed(`Finished testing all ${totalMutants} mutants.`);
    return results;
  }

  /**
   * Starts the application in watch mode.
   * It will perform an initial run and then watch for file changes to re-run.
   */
  async watch() {
    console.log(pc.cyan('Starting in watch mode...'));
    await this.run(); // Perform initial run

    const watcher = chokidar.watch(
        [...this.config.sourceFiles, ...this.config.testFiles],
        {
            ignored: this.config.ignorePatterns,
            ignoreInitial: true, // Don't trigger on initial add
            persistent: true,
        }
    );

    console.log(pc.yellow('\nWatching for file changes. Press Ctrl+C to exit.'));

    watcher.on('all', (event, path) => {
      console.clear();
      console.log(pc.bold(pc.magenta(`\n[${new Date().toLocaleTimeString()}] File change detected: ${event} - ${path}`)));
      this.run();
    });
  }
}

/**
 * Sets up and runs the CLI.
 * This function parses arguments, loads configuration, and starts the application.
 */
export async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .command('$0', 'Run mutation testing', (y) => y)
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to a custom configuration file.',
      normalize: true,
    })
    .option('mutators', {
      alias: 'm',
      type: 'array',
      description: 'Comma-separated list of mutators to use (e.g., "BinaryExpression,StringLiteral"). Overrides config file.',
      choices: availableMutators.map(m => m.name),
    })
    .option('watch', {
      alias: 'w',
      type: 'boolean',
      description: 'Enable watch mode to re-run tests on file changes.',
      default: false,
    })
    .option('concurrency', {
      type: 'number',
      description: 'Number of parallel workers to use. Defaults to number of CPU cores.',
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      description: 'Timeout for a single test run in milliseconds.',
    })
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .epilog('For more information, visit the project repository.')
    .strict()
    .parse();

  try {
    const config = await loadConfig(argv);
    const app = new MutationTesterApp(config);

    if (config.watch) {
      await app.watch();
    } else {
      await app.run();
    }
  } catch (error) {
    console.error(pc.red(`\n🚨 Critical Error: ${error.message}`));
    console.error(pc.dim(error.stack));
    process.exit(1);
  }
}