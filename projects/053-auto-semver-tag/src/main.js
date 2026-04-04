/**
 * @file src/main.js
 * @description The main application logic orchestrating the process: get commits,
 * calculate version, generate changelog, and create/push tag.
 */

import { loadConfig } from './config/loader.js';
import { getLatestSemVerTag, isWorkingDirClean, createTag, pushTag } from './git/wrapper.js';
import { getAndParseCommits } from './commits/parser.js';
import { calculateNextVersion } from './versioning/calculator.js';
import { generateChangelog } from './changelog/generator.js';
import logger from './ui/logger.js';

/**
 * @typedef {import('./config/loader.js').Config} AppConfig
 */

/**
 * The main orchestration function for the auto-semver-tagger CLI.
 * It coordinates the entire process from configuration loading to tag creation.
 *
 * @param {object} cliArgs - Command-line arguments parsed by yargs.
 * @returns {Promise<void>} A promise that resolves when the process is complete or an error occurs.
 */
export async function run(cliArgs) {
  try {
    // 1. Load and merge configuration from all sources
    const config = await loadConfig(cliArgs);
    logger.setVerbose(config.verbose);
    logger.verbose(`Configuration loaded: ${JSON.stringify(config, null, 2)}`);

    // 2. Pre-flight checks
    logger.title('Running Pre-flight Checks');
    if (!config.dryRun) {
      if (!(await isWorkingDirClean())) {
        logger.warn('Your working directory has uncommitted changes.');
        logger.warn('It is recommended to commit or stash them before running.');
        // This is a warning, not a hard stop, but could be made one if desired.
      } else {
        logger.success('Working directory is clean.');
      }
    } else {
      logger.info('Dry run mode: Skipping working directory check.');
    }

    // 3. Fetch Git history
    logger.title('Analyzing Git History');
    const latestTag = await getLatestSemVerTag();

    const commits = await getAndParseCommits(latestTag);
    if (commits.length === 0) {
      logger.warn('No new conventional commits found since the last tag. Nothing to do.');
      return;
    }

    // 4. Calculate the next version
    logger.title('Calculating Next Version');
    const nextVersion = calculateNextVersion(latestTag, commits, config.prerelease);

    if (!nextVersion) {
      logger.info('No version bump required based on the commits. Exiting.');
      return;
    }
    logger.success(`Calculated next version: ${nextVersion}`);

    // 5. Generate the changelog
    logger.title('Generating Changelog');
    const changelog = generateChangelog(nextVersion, commits);
    logger.log(changelog);

    // 6. Perform the release (or simulate it in dry-run)
    logger.title('Release Execution');
    const newTagName = `${config.tagPrefix}${nextVersion}`;
    const tagAnnotation = `${config.changelogTitle}${changelog}`;

    if (config.dryRun) {
      logger.info('--- DRY RUN ---');
      logger.info(`Would create tag: ${newTagName}`);
      if (config.push) {
        logger.info(`Would push tag to remote: ${config.remote}`);
      }
      logger.info('--- END DRY RUN ---');
      logger.success('Dry run completed successfully.');
      return;
    }

    // Actual execution
    await createTag(newTagName, tagAnnotation);

    if (config.push) {
      await pushTag(newTagName, config.remote);
    } else {
      logger.info('Skipping push. Use the --push flag to push the new tag to the remote.');
    }

    logger.success('Auto-versioning process completed successfully!');

  } catch (error) {
    logger.error('An unrecoverable error occurred:');
    // We check for a `cause` property, which our custom errors provide.
    const errorMessage = error.cause ? `${error.message}\nCause: ${error.cause.message}` : error.message;
    logger.error(errorMessage);
    logger.verbose(error.stack);
    // Exit with a non-zero code to indicate failure, which is important for CI/CD pipelines.
    process.exit(1);
  }
}