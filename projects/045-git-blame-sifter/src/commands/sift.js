/**
 * @file src/commands/sift.js
 * @module commands/sift
 * @description The main command handler for the 'sift' operation. It orchestrates
 * the entire process of blaming a file, analyzing commits, walking history for
 * trivial changes, and formatting the output.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import { streamGitCommand, isGitRepository, GitCommandError } from '../utils/git-executor.js';
import { parsePorcelainBlame } from '../analysis/blame-parser.js';
import { runRuleEngine } from '../engine/rule-engine.js';
import { findSubstantiveBlame } from '../analysis/history-walker.js';
import * as formatters from '../formatters/index.js';

/**
 * Reads the entire content of a stream into a single string.
 *
 * @param {import('stream').Readable} stream - The readable stream to consume.
 * @returns {Promise<string>} A promise that resolves with the full string content of the stream.
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * The main orchestration function for the `sift` command.
 *
 * @param {string} filePath - The relative path of the file to analyze.
 * @param {object} config - The merged configuration object.
 * @returns {Promise<void>} A promise that resolves when the analysis and formatting are complete.
 */
export async function sift(filePath, config) {
  const spinner = ora({
    text: 'Initializing...',
    spinner: 'dots',
    color: 'cyan',
    isSilent: !config.showProgress,
  });

  try {
    // --- 1. Initial Setup and Validation ---
    spinner.start('Validating environment...');
    const absoluteFilePath = path.resolve(process.cwd(), filePath);
    const repoPath = process.cwd(); // Assuming command is run from repo root. Future improvement: find git root.

    if (!(await isGitRepository(repoPath))) {
      throw new Error('Not a Git repository. Please run this command from within a Git working directory.');
    }

    try {
      await fs.access(absoluteFilePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // --- 2. Execute `git blame` ---
    spinner.text = `Running git blame on ${chalk.bold(filePath)}...`;
    const blameArgs = [
      'blame',
      '--porcelain',
      '--incremental', // More machine-readable and sometimes faster
      ...(config['follow-aliases'] ? ['-M'] : []), // Detect moved/copied lines within a file
      ...(config['blame-args'] ? config['blame-args'].split(' ') : []), // Allow custom user args
      '--',
      filePath,
    ];

    const blameStream = await streamGitCommand(blameArgs, { cwd: repoPath });
    const porcelainOutput = await streamToString(blameStream);

    if (!porcelainOutput.trim()) {
      spinner.succeed('File has no history or is empty.');
      return;
    }

    // --- 3. Parse Blame Output ---
    spinner.text = 'Parsing blame data...';
    const { lines: blameLines, commits: originalCommits } = parsePorcelainBlame(porcelainOutput);

    // --- 4. Analyze and Sift Commits ---
    spinner.text = `Sifting ${blameLines.length} lines through ${originalCommits.size} commits...`;
    const processedBlame = [];
    const analysisContext = { config, repoPath };

    let trivialCommitCount = 0;
    const lineProcessingPromises = blameLines.map(async (line, index) => {
      spinner.text = `Analyzing line ${index + 1}/${blameLines.length}...`;
      const originalCommit = line.commit;

      // Run the rule engine on the original commit for this line.
      const ruleResult = await runRuleEngine(originalCommit, analysisContext);

      let siftedCommit = originalCommit;
      if (ruleResult.isTrivial) {
        trivialCommitCount++;
        // If trivial, walk history to find the substantive commit.
        siftedCommit = await findSubstantiveBlame(
          originalCommit,
          line.originalLine,
          originalCommit.filename,
          analysisContext
        );
      }

      return {
        ...line, // Includes originalLine, finalLine, content
        originalCommit,
        siftedCommit,
        isTrivial: ruleResult.isTrivial,
        trivialityReason: ruleResult.reason,
      };
    });

    const results = await Promise.all(lineProcessingPromises);
    // Ensure the results are in the correct order.
    results.sort((a, b) => a.finalLine - b.finalLine);
    processedBlame.push(...results);

    spinner.succeed(`Analysis complete. Found ${trivialCommitCount} trivial line changes.`);

    // --- 5. Format and Display Results ---
    const formatter = formatters[config.format] ?? formatters.standard;
    if (typeof formatter !== 'function') {
      throw new Error(`Unknown output format: "${config.format}". Available formats: ${Object.keys(formatters).join(', ')}`);
    }

    const analysisResult = {
      filePath,
      processedBlame,
      stats: {
        totalLines: blameLines.length,
        totalCommits: originalCommits.size,
        trivialCommits: trivialCommitCount,
      },
    };

    // Stop the spinner before printing final output to avoid interference.
    spinner.stop();
    await formatter(analysisResult, config);

  } catch (error) {
    spinner.fail('An error occurred during the sift operation.');
    // Log the detailed error message.
    console.error(chalk.red('\nError Details:'));
    if (error instanceof GitCommandError) {
      console.error(chalk.red(`Git Command Failed: ${error.command}`));
      console.error(chalk.gray(error.stderr || 'No standard error output.'));
    } else {
      console.error(chalk.red(error.message));
      if (error.cause) {
        console.error(chalk.gray('Caused by:'), error.cause);
      }
    }
    // Exit with a non-zero code to indicate failure, useful for scripting.
    process.exit(1);
  }
}