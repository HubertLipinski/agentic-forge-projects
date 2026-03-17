import chalk from 'chalk';
import { getWorktrees, isGitRepository, getGitRoot } from '../utils/git.js';
import { loadConfig } from '../config.js';
import { relative } from 'node:path';

/**
 * A utility class to format and print data in a table-like structure.
 * It automatically calculates column widths based on the content.
 */
class Table {
  /**
   * @param {object} options
   * @param {string[]} options.headers - The headers for the table.
   * @param {number} [options.padding=2] - The number of spaces between columns.
   */
  constructor({ headers, padding = 2 }) {
    this.headers = headers;
    this.rows = [];
    this.padding = ' '.repeat(padding);
    this.columnWidths = headers.map(h => h.length);
  }

  /**
   * Adds a row of data to the table.
   * @param {string[]} rowData - An array of strings representing the cells in the row.
   */
  addRow(rowData) {
    if (rowData.length !== this.headers.length) {
      throw new Error('Row data must have the same number of columns as the headers.');
    }
    this.rows.push(rowData);
    // Update column widths based on the new row's content
    for (let i = 0; i < rowData.length; i++) {
      this.columnWidths[i] = Math.max(this.columnWidths[i], rowData[i].length);
    }
  }

  /**
   * Renders the complete table as a formatted string.
   * @returns {string} The formatted table string.
   */
  toString() {
    const lines = [];

    // Header row
    const headerLine = this.headers
      .map((header, i) => chalk.bold(header.padEnd(this.columnWidths[i])))
      .join(this.padding);
    lines.push(headerLine);

    // Separator line
    const separatorLine = this.columnWidths
      .map(width => '─'.repeat(width))
      .join(this.padding.replace(/ /g, '─'));
    lines.push(chalk.dim(separatorLine));

    // Data rows
    for (const row of this.rows) {
      const rowLine = row
        .map((cell, i) => cell.padEnd(this.columnWidths[i]))
        .join(this.padding);
      lines.push(rowLine);
    }

    return lines.join('\n');
  }
}

/**
 * Formats a worktree object for display.
 * @param {object} worktree - The worktree object from getWorktrees().
 * @param {string} gitRoot - The absolute path to the git repository root.
 * @returns {{branch: string, path: string, status: string}} - A formatted object for the table row.
 */
function formatWorktree(worktree, gitRoot) {
  let branch = worktree.branch;
  let status = 'OK';
  let path = relative(gitRoot, worktree.path) || '.'; // Show '.' for the main worktree path

  if (worktree.isMain) {
    branch = `${chalk.cyan(worktree.branch)} ${chalk.dim('(main)')}`;
  }

  if (worktree.isPrunable) {
    status = chalk.yellow('PRUNABLE');
    branch = `${chalk.strikethrough(worktree.branch)} ${chalk.yellow('(?)')}`;
  }

  return { branch, path: chalk.green(path), status };
}

/**
 * Implements the 'list' command logic.
 * Fetches and displays all current worktrees in a formatted table.
 *
 * @param {object} options - Command-line options (currently unused).
 */
export async function listCommand(options) {
  try {
    if (!(await isGitRepository())) {
      console.error(chalk.red('Error: Not a Git repository.'));
      console.error(chalk.yellow('Please run this command from within a Git repository.'));
      process.exit(1);
    }

    const [worktrees, gitRoot] = await Promise.all([
      getWorktrees(),
      getGitRoot(),
      loadConfig(), // Load config to ensure consistency, though not directly used here.
    ]);

    if (worktrees.length === 0) {
      console.log(chalk.yellow('No worktrees found. This is unexpected for a valid Git repository.'));
      return;
    }

    console.log(chalk.bold.underline(`Worktrees for repository: ${gitRoot}\n`));

    const table = new Table({
      headers: ['Branch', 'Path', 'Status'],
    });

    // Sort worktrees: main worktree first, then by branch name.
    const sortedWorktrees = worktrees.sort((a, b) => {
      if (a.isMain) return -1;
      if (b.isMain) return 1;
      return a.branch.localeCompare(b.branch);
    });

    for (const worktree of sortedWorktrees) {
      const { branch, path, status } = formatWorktree(worktree, gitRoot);
      table.addRow([branch, path, status]);
    }

    console.log(table.toString());

    if (worktrees.some(wt => wt.isPrunable)) {
      console.log(chalk.yellow('\nNote: Found prunable worktrees. Their branches may have been deleted.'));
      console.log(chalk.yellow(`Run ${chalk.bold('gwo clean')} to remove them.`));
    }

  } catch (error) {
    console.error(chalk.red('An error occurred while listing worktrees:'));
    console.error(chalk.red(error.message));
    if (error.name !== 'GitError' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}