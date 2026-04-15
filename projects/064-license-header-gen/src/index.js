/**
 * @file src/index.js
 * @description Main application entry point for the License Header Generator CLI.
 *
 * This module orchestrates the entire process:
 * 1. Parses command-line arguments.
 * 2. Loads configuration (license template, package.json data).
 * 3. Scans for target files.
 * 4. Processes each file to add or update the license header.
 * 5. Generates a summary report of the operations performed.
 */

import yargsParser from 'yargs-parser';
import { resolve, extname } from 'node:path';
import { findFilesByExtension, readFileContent } from './utils/file-system.js';
import { getCommentStyle } from './utils/comment-styles.js';
import { buildHeader } from './core/header-builder.js';
import { processFile, FileStatus } from './core/processor.js';

const DEFAULT_EXTENSIONS = [
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx',
  '.css', '.scss', '.less', '.html', '.vue', '.py', '.sh', '.java',
  '.go', '.rs', '.php', '.rb', '.yml', '.yaml',
];
const DEFAULT_DIRS = ['.'];
const DEFAULT_LICENSE_PATH = 'LICENSE';
const DEFAULT_PACKAGE_JSON_PATH = 'package.json';

/**
 * Parses command-line arguments and establishes the application configuration.
 *
 * @param {string[]} argv - The command-line arguments array (e.g., from process.argv.slice(2)).
 * @returns {object} The parsed and normalized configuration object.
 */
function parseArguments(argv) {
  const args = yargsParser(argv, {
    string: ['dir', 'ext', 'license', 'year', 'author'],
    boolean: ['dry-run', 'help', 'version'],
    alias: {
      d: 'dir',
      e: 'ext',
      l: 'license',
      h: 'help',
      v: 'version',
    },
    configuration: {
      'strip-dashed': true, // e.g., --dry-run becomes dryRun
      'camel-case-expansion': true,
    },
  });

  // Normalize array-like arguments (yargs-parser can return a string or an array)
  const dirs = Array.isArray(args.dir) ? args.dir : (args.dir ? [args.dir] : DEFAULT_DIRS);
  const extensions = Array.isArray(args.ext) ? args.ext : (args.ext ? args.ext.split(',').map(e => e.trim()) : DEFAULT_EXTENSIONS);

  return {
    dirs: dirs.map(dir => resolve(process.cwd(), dir)),
    extensions: new Set(extensions.map(ext => ext.startsWith('.') ? ext : `.${ext}`)),
    licensePath: args.license ? resolve(process.cwd(), args.license) : resolve(process.cwd(), DEFAULT_LICENSE_PATH),
    customYear: args.year,
    customAuthor: args.author,
    isDryRun: args.dryRun ?? false,
    showHelp: args.help ?? false,
    showVersion: args.version ?? false,
  };
}

/**
 * Loads dynamic data (author, year) from package.json.
 *
 * @param {object} config - The application configuration.
 * @returns {Promise<{author: string, year: string}>} An object with author and year.
 */
async function loadDynamicData(config) {
  const dynamicData = {
    author: config.customAuthor,
    year: config.customYear,
  };

  // Only load package.json if author or year is not fully specified via CLI args.
  if (dynamicData.author && dynamicData.year) {
    return dynamicData;
  }

  try {
    const pkgPath = resolve(process.cwd(), DEFAULT_PACKAGE_JSON_PATH);
    const pkgContent = await readFileContent(pkgPath);
    const pkg = JSON.parse(pkgContent);

    // Prefer CLI args, fall back to package.json, then to defaults.
    dynamicData.author = dynamicData.author ?? pkg.author ?? '';
    dynamicData.year = dynamicData.year ?? String(new Date().getFullYear());
  } catch (error) {
    // It's not a fatal error if package.json is missing, but we should inform the user.
    if (error.message.includes('File not found')) {
      console.warn(`Warning: ${DEFAULT_PACKAGE_JSON_PATH} not found. Using provided args or defaults for author/year.`);
    } else {
      console.warn(`Warning: Could not parse ${DEFAULT_PACKAGE_JSON_PATH}: ${error.message}`);
    }
    // Ensure year has a fallback even if package.json fails.
    dynamicData.year = dynamicData.year ?? String(new Date().getFullYear());
  }

  return dynamicData;
}

/**
 * Displays the help message for the CLI tool.
 */
function displayHelp() {
  console.log(`
  License Header Generator

  A lightweight CLI tool to automatically add or update license headers in your source files.

  Usage:
    license-header-generator [options]

  Options:
    -d, --dir <path>        Directory to scan (can be used multiple times).
                            (default: current directory)
    -e, --ext <extensions>  Comma-separated file extensions to process.
                            (default: .js,.ts,.py,...)
    -l, --license <path>    Path to the license template file.
                            (default: ./LICENSE)
    --author <name>         Override the author name (otherwise parsed from package.json).
    --year <year>           Override the copyright year (otherwise defaults to current year).
    --dry-run               Run without writing any changes to files.
    -h, --help              Show this help message.
    -v, --version           Show the version number.

  Example:
    license-header-generator --dir src --dir test --ext .js,.ts
  `);
}

/**
 * Displays the version of the package.
 */
async function displayVersion() {
  try {
    const pkgPath = resolve(new URL(import.meta.url).pathname, '../../package.json');
    const pkgContent = await readFileContent(pkgPath);
    const { version } = JSON.parse(pkgContent);
    console.log(`license-header-generator v${version}`);
  } catch (error) {
    console.error('Error reading package version:', error.message);
  }
}

/**
 * Generates and prints a summary report of the processing results.
 *
 * @param {Map<FileStatus, string[]>} results - A map of file statuses to lists of file paths.
 * @param {boolean} isDryRun - Indicates if the run was a dry run.
 */
function generateReport(results, isDryRun) {
  console.log('\n--- Processing Summary ---');

  const added = results.get(FileStatus.ADDED)?.length ?? 0;
  const updated = results.get(FileStatus.UPDATED)?.length ?? 0;
  const skipped = results.get(FileStatus.SKIPPED)?.length ?? 0;
  const errors = results.get(FileStatus.ERROR)?.length ?? 0;
  const dryRunChanges = results.get(FileStatus.DRY_RUN)?.length ?? 0;

  if (isDryRun) {
    console.log('DRY RUN MODE: No files were modified.');
    console.log(`- Would be added/updated: ${dryRunChanges} file(s)`);
  } else {
    console.log(`- Added:   ${added} file(s)`);
    console.log(`- Updated: ${updated} file(s)`);
  }

  console.log(`- Skipped: ${skipped} file(s) (already up-to-date)`);
  console.log(`- Errors:  ${errors} file(s)`);

  if (errors > 0) {
    console.log('\nFiles with errors:');
    results.get(FileStatus.ERROR)?.forEach(file => console.log(`  - ${file}`));
  }

  console.log('------------------------');
}

/**
 * The main application runner.
 * It parses arguments, finds files, and processes them.
 *
 * @param {string[]} argv - Command-line arguments.
 * @throws {Error} If a fatal error occurs (e.g., license file not found).
 */
export async function run(argv) {
  const config = parseArguments(argv);

  if (config.showHelp) {
    displayHelp();
    return;
  }
  if (config.showVersion) {
    await displayVersion();
    return;
  }

  console.log('🔍 Starting license header processing...');
  if (config.isDryRun) {
    console.log('DRY RUN enabled. No files will be changed.');
  }

  const [licenseText, dynamicData] = await Promise.all([
    readFileContent(config.licensePath).catch(err => {
      // This is a fatal error, as we cannot proceed without a license template.
      throw new Error(`Failed to load license template from "${config.licensePath}": ${err.message}`);
    }),
    loadDynamicData(config),
  ]);

  const fileScanPromises = config.dirs.map(dir =>
    findFilesByExtension(dir, config.extensions)
  );
  const allFilesNested = await Promise.all(fileScanPromises);
  const filesToProcess = [...new Set(allFilesNested.flat())]; // Flatten and deduplicate

  if (filesToProcess.length === 0) {
    console.log('No matching files found to process.');
    return;
  }

  console.log(`Found ${filesToProcess.length} file(s) to process.`);

  const results = new Map();
  const processingPromises = filesToProcess.map(async (filePath) => {
    const extension = extname(filePath);
    const commentStyle = getCommentStyle(extension);

    if (!commentStyle) {
      console.warn(`Warning: No comment style found for "${filePath}". Skipping.`);
      return;
    }

    const newHeader = buildHeader({ licenseText, commentStyle, dynamicData });
    const status = await processFile({
      filePath,
      newHeader,
      commentStyle,
      isDryRun: config.isDryRun,
    });

    if (!results.has(status)) {
      results.set(status, []);
    }
    results.get(status).push(filePath);
  });

  await Promise.all(processingPromises);

  generateReport(results, config.isDryRun);

  if (results.has(FileStatus.ERROR)) {
    // Signal an issue to the calling script/environment
    throw new Error('Processing completed with one or more errors.');
  }
}