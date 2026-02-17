import { reportChangedFiles } from './lib/reporter.js';
import { parseArgs } from 'node:util';

const scriptName = 'git-changed-files-reporter';

const {
  values: { reference, filter, format, includeUntracked },
  positionals,
} = parseArgs({
  options: {
    reference: {
      type: 'string',
      short: 'r',
      default: 'HEAD~1',
      description: 'The Git reference (commit, tag, or branch) to compare against. Defaults to HEAD~1.',
    },
    filter: {
      type: 'string',
      short: 'f',
      description: 'Filter changes by file extension (e.g., "js", ".ts").',
    },
    format: {
      type: 'string',
      short: 'o',
      values: ['json', 'list'],
      default: 'list',
      description: 'Output format: "json" or "list". Defaults to "list".',
    },
    includeUntracked: {
      type: 'boolean',
      short: 'u',
      default: false,
      description: 'Include untracked files in the report.',
    },
  },
  allowPositionals: true,
});

/**
 * Main function to parse arguments and run the reporter.
 */
async function main() {
  try {
    const files = await reportChangedFiles({
      reference,
      filterExtension: filter,
      includeUntracked: includeUntracked,
    });

    if (files.length === 0) {
      console.error('No changes found.');
      process.exitCode = 1; // Exit with non-zero code if no changes
      return;
    }

    if (format === 'json') {
      console.log(JSON.stringify(files, null, 2));
    } else {
      files.forEach(file => console.log(file));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

main();