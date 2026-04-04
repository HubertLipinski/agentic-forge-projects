import semver from 'semver';
import logger from '../ui/logger.js';

/**
 * @typedef {import('../commits/parser.js').ConventionalCommit} ConventionalCommit
 */

/**
 * Represents the type of version bump determined from commits.
 * @typedef {'major' | 'minor' | 'patch' | 'prerelease' | 'none'} BumpType
 */

/**
 * A custom error class for version calculation failures.
 */
class VersioningError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'VersioningError';
    this.cause = cause;
  }
}

/**
 * Determines the highest-priority version bump type from a list of commits.
 * The priority is: Major > Minor > Patch.
 *
 * - A 'major' bump is triggered by a commit with a 'BREAKING CHANGE' note.
 * - A 'minor' bump is triggered by a 'feat' (feature) commit.
 * - A 'patch' bump is triggered by a 'fix' commit.
 *
 * @param {ConventionalCommit[]} commits - An array of parsed conventional commits.
 * @returns {BumpType} The determined bump type ('major', 'minor', 'patch', or 'none').
 */
function getBumpTypeFromCommits(commits) {
  let bumpType = 'none';

  for (const commit of commits) {
    // Major bump: Highest priority. If we find one, we can stop searching.
    if (commit.notes?.some(note => note.title.toUpperCase().includes('BREAKING CHANGE'))) {
      logger.info('Found a BREAKING CHANGE, indicating a major version bump.');
      return 'major';
    }

    // Minor bump: Triggered by 'feat'.
    if (commit.type === 'feat') {
      if (bumpType !== 'minor' && bumpType !== 'major') {
        bumpType = 'minor';
      }
    }

    // Patch bump: Triggered by 'fix'. Lowest priority among bumping types.
    if (commit.type === 'fix') {
      if (bumpType === 'none') {
        bumpType = 'patch';
      }
    }
  }

  return bumpType;
}

/**
 * Calculates the next semantic version based on the current version, commit analysis,
 * and pre-release options.
 *
 * @param {string|null} currentVersion - The current version string (e.g., '1.2.3'). Can be null if no previous version exists.
 * @param {ConventionalCommit[]} commits - An array of parsed conventional commits since the last version.
 * @param {string|boolean} prereleaseIdentifier - A string for the pre-release (e.g., 'alpha', 'rc'), or false if not a pre-release.
 * @returns {string|null} The calculated next version string, or null if no version change is warranted.
 * @throws {VersioningError} If the current version is invalid or a pre-release cannot be applied.
 */
export function calculateNextVersion(currentVersion, commits, prereleaseIdentifier) {
  const baseVersion = currentVersion || '0.0.0';

  if (!semver.valid(baseVersion)) {
    throw new VersioningError(`The provided current version '${baseVersion}' is not a valid SemVer string.`);
  }

  const bumpType = getBumpTypeFromCommits(commits);

  if (bumpType === 'none' && !prereleaseIdentifier) {
    logger.info('No relevant commits found (feat, fix, or BREAKING CHANGE). No new version will be generated.');
    return null;
  }

  // If this is the very first release and there are no bumping commits, but a prerelease is requested,
  // we should start from 0.1.0-alpha.0 or similar.
  const effectiveBump = (baseVersion === '0.0.0' && bumpType === 'none') ? 'minor' : bumpType;

  // If a prerelease is requested, the logic is slightly different.
  // We first check if the current version is already a prerelease with the same identifier.
  if (prereleaseIdentifier && typeof prereleaseIdentifier === 'string') {
    const currentPrerelease = semver.prerelease(baseVersion);

    // Case 1: Current version is already a prerelease with the same identifier.
    // We just increment the prerelease number (e.g., 1.0.0-alpha.0 -> 1.0.0-alpha.1).
    if (Array.isArray(currentPrerelease) && currentPrerelease[0] === prereleaseIdentifier) {
      // If there's a more significant change (e.g., a `feat` while on a `fix` prerelease),
      // we bump the main version first, then start the prerelease counter.
      const newVersionFromBump = semver.inc(baseVersion, effectiveBump);
      if (semver.gt(newVersionFromBump, baseVersion)) {
        return semver.inc(newVersionFromBump, 'prerelease', prereleaseIdentifier);
      }
      return semver.inc(baseVersion, 'prerelease', prereleaseIdentifier);
    }

    // Case 2: New prerelease cycle. Bump the version first, then add the prerelease tag.
    // (e.g., from 1.2.3 to 1.3.0-alpha.0 if a 'feat' commit exists).
    // If no bump is detected, we still bump patch by default to start the prerelease.
    const releaseType = effectiveBump === 'none' ? 'patch' : effectiveBump;
    const bumpedVersion = semver.inc(baseVersion, releaseType);
    return semver.inc(bumpedVersion, 'prerelease', prereleaseIdentifier);
  }

  // Standard release (not a prerelease).
  if (bumpType === 'none') {
    // This case should have been handled at the top, but as a safeguard:
    return null;
  }

  // If the current version is a prerelease and we are moving to a stable version,
  // we just finalize the version without incrementing further.
  // e.g., from '1.0.0-rc.1' to '1.0.0'
  if (semver.prerelease(baseVersion)) {
    const mainVersion = `${semver.major(baseVersion)}.${semver.minor(baseVersion)}.${semver.patch(baseVersion)}`;
    const bumpedFromPrerelease = semver.inc(mainVersion, bumpType);

    // If the bump type is greater than what the prerelease was based on, respect the bump.
    // e.g., from 1.0.0-rc.1, a BREAKING CHANGE should result in 2.0.0, not 1.0.0
    if (semver.gt(bumpedFromPrerelease, mainVersion)) {
        return bumpedFromPrerelease;
    }
    return mainVersion;
  }

  // Standard increment based on commit analysis.
  return semver.inc(baseVersion, bumpType);
}