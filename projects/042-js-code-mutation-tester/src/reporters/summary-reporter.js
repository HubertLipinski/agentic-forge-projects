import pc from 'picocolors';
import { generateDiff } from './diff-generator.js';
import { MUTANT_STATUS } from '../constants.js';

/**
 * @typedef {import('../core/mutation-engine.js').MutantTestResult} MutantTestResult
 * @typedef {import('../core/mutant-generator.js').Mutant} Mutant
 */

/**
 * A utility class to format and print the final mutation testing summary report.
 * It calculates statistics, formats them with colors, and displays detailed
 * information about surviving mutants, including code diffs.
 */
class SummaryReporter {
  /**
   * @param {MutantTestResult[]} results - The array of results from the mutation engine.
   * @param {number} totalMutants - The total number of mutants generated.
   * @param {object} [options={}] - Configuration options for the reporter.
   * @param {boolean} [options.showDiff=true] - Whether to show diffs for survivors.
   */
  constructor(results, totalMutants, options = {}) {
    if (!Array.isArray(results)) {
      throw new Error('SummaryReporter requires an array of results.');
    }
    this.results = results;
    this.totalMutants = totalMutants;
    this.options = {
      showDiff: true,
      ...options,
    };
    this.stats = this._calculateStats();
  }

  /**
   * Calculates key statistics from the test results.
   * @returns {{
   *   killed: number,
   *   survived: number,
   *   timedOut: number,
   *   error: number,
   *   pending: number,
   *   totalDetected: number,
   *   totalUndetected: number,
   *   totalCovered: number,
   *   mutationScore: number
   * }} The calculated statistics.
   * @private
   */
  _calculateStats() {
    const stats = {
      killed: 0,
      survived: 0,
      timedOut: 0,
      error: 0,
    };

    for (const result of this.results) {
      switch (result.status) {
        case MUTANT_STATUS.KILLED:
          stats.killed++;
          break;
        case MUTANT_STATUS.SURVIVED:
          stats.survived++;
          break;
        case MUTANT_STATUS.TIMED_OUT:
          stats.timedOut++;
          break;
        case MUTANT_STATUS.ERROR:
          stats.error++;
          break;
      }
    }

    const totalDetected = stats.killed + stats.timedOut;
    const totalUndetected = stats.survived;
    const totalCovered = totalDetected + totalUndetected;
    const pending = this.totalMutants - this.results.length;

    // Mutation score is the percentage of detected mutants out of all covered mutants.
    // Mutants that errored are not included in this calculation.
    const mutationScore =
      totalCovered > 0 ? (totalDetected / totalCovered) * 100 : 100;

    return {
      ...stats,
      pending,
      totalDetected,
      totalUndetected,
      totalCovered,
      mutationScore,
    };
  }

  /**
   * Generates and prints the full summary report to the console.
   */
  async print() {
    console.log('\n' + pc.bold(pc.inverse(pc.blue(' Mutation Test Report '))) + '\n');
    this._printScore();
    this._printStatsTable();
    await this._printSurvivors();
    this._printErrors();
    console.log(''); // Final newline for clean exit
  }

  /**
   * Prints the main mutation score.
   * @private
   */
  _printScore() {
    const { mutationScore } = this.stats;
    const scoreText = `${mutationScore.toFixed(2)}%`;
    let scoreColor;

    if (mutationScore >= 90) {
      scoreColor = pc.green;
    } else if (mutationScore >= 70) {
      scoreColor = pc.yellow;
    } else {
      scoreColor = pc.red;
    }

    console.log(
      `${pc.bold('Mutation Score:')} ${pc.bold(scoreColor(scoreText))}`
    );
    console.log(pc.dim('----------------------------------'));
  }

  /**
   * Prints the detailed statistics table.
   * @private
   */
  _printStatsTable() {
    const {
      totalMutants,
      killed,
      timedOut,
      survived,
      pending,
      error,
    } = this.stats;

    const table = [
      { label: 'Total mutants', value: totalMutants, color: pc.blue },
      { label: 'Mutants killed', value: killed, color: pc.green },
      { label: 'Timeouts', value: timedOut, color: pc.yellow },
      { label: 'Mutants survived', value: survived, color: pc.red },
      { label: 'Pending', value: pending, color: pc.gray },
      { label: 'Errors', value: error, color: pc.magenta },
    ];

    const maxLabelLength = Math.max(...table.map(row => row.label.length));

    table.forEach(({ label, value, color }) => {
      console.log(
        `${label.padEnd(maxLabelLength)}: ${color(pc.bold(String(value).padStart(4)))}`
      );
    });
    console.log(pc.dim('----------------------------------'));
  }

  /**
   * Prints details for each surviving mutant, including a diff.
   * @private
   */
  async _printSurvivors() {
    const survivors = this.results.filter(
      (r) => r.status === MUTANT_STATUS.SURVIVED
    );

    if (survivors.length === 0) {
      return;
    }

    console.log(
      `\n${pc.bold(pc.red(`Survivors (${survivors.length}):`))}`
    );

    for (const [index, result] of survivors.entries()) {
      const { mutant } = result;
      const { sourceFilePath, location, description } = mutant;
      const relativePath = sourceFilePath.replace(process.cwd() + '/', '');
      const locationString = `${relativePath}:${location.start.line}:${location.start.column}`;

      console.log(
        `\n${pc.bold(`${index + 1}.`)} ${pc.yellow(locationString)}`
      );
      console.log(`   ${pc.cyan('Mutator:')} ${mutant.mutatorName}`);
      console.log(`   ${pc.cyan('Change:')}  ${description}`);

      if (this.options.showDiff) {
        try {
          const diff = await generateDiff(mutant);
          console.log(pc.dim('--- Diff ---'));
          console.log(diff);
          console.log(pc.dim('------------'));
        } catch (error) {
          console.log(pc.red(`   Could not generate diff: ${error.message}`));
        }
      }
    }
  }

  /**
   * Prints details for any test runs that resulted in an error.
   * @private
   */
  _printErrors() {
    const errors = this.results.filter((r) => r.status === MUTANT_STATUS.ERROR);

    if (errors.length === 0) {
      return;
    }

    console.log(`\n${pc.bold(pc.magenta(`Errors (${errors.length}):`))}`);
    errors.forEach((result, index) => {
      const { mutant, error } = result;
      const { sourceFilePath, id } = mutant;
      const relativePath = sourceFilePath.replace(process.cwd() + '/', '');

      console.log(
        `\n${pc.bold(`${index + 1}.`)} Mutant ${id} in ${pc.yellow(relativePath)}`
      );
      console.log(`   ${pc.red('Error:')} ${error}`);
    });
  }
}

/**
 * Factory function to create and run a SummaryReporter.
 * This is the main export of the module, providing a simple interface
 * for generating and printing the final report.
 *
 * @param {MutantTestResult[]} results - The array of results from the mutation engine.
 * @param {number} totalMutants - The total number of mutants generated.
 * @param {object} config - The application configuration object.
 * @returns {Promise<void>} A promise that resolves when the report has been printed.
 */
export async function reportSummary(results, totalMutants, config) {
  try {
    const reporter = new SummaryReporter(results, totalMutants, {
      showDiff: config.reporter?.showDiff ?? true,
    });
    await reporter.print();
  } catch (error) {
    console.error(pc.red('Failed to generate summary report:'), error);
  }
}