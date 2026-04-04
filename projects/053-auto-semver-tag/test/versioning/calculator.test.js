import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { calculateNextVersion } from '../../src/versioning/calculator.js';
import logger from '../../src/ui/logger.js';

// Mock the logger to prevent console output during tests
mock.method(logger, 'info', () => {});
mock.method(logger, 'warn', () => {});
mock.method(logger, 'error', () => {});

// Helper function to create mock commit objects
const createCommit = (type, subject, notes = []) => ({
  type,
  subject,
  notes,
  scope: null,
  body: null,
  footer: null,
  header: `${type}: ${subject}`,
  raw: `${type}: ${subject}`,
});

const featCommit = createCommit('feat', 'add new feature');
const fixCommit = createCommit('fix', 'resolve a bug');
const choreCommit = createCommit('chore', 'update dependencies');
const breakingChangeCommit = createCommit(
  'feat',
  'refactor API for performance',
  [{ title: 'BREAKING CHANGE', text: 'The API now requires a new parameter.' }]
);

describe('versioning/calculator.js', () => {
  describe('calculateNextVersion() - Standard Releases', () => {
    test('should return a patch version for a `fix` commit', () => {
      const nextVersion = calculateNextVersion('1.2.3', [fixCommit], false);
      assert.strictEqual(nextVersion, '1.2.4');
    });

    test('should return a minor version for a `feat` commit', () => {
      const nextVersion = calculateNextVersion('1.2.3', [featCommit], false);
      assert.strictEqual(nextVersion, '1.3.0');
    });

    test('should return a major version for a BREAKING CHANGE commit', () => {
      const nextVersion = calculateNextVersion('1.2.3', [breakingChangeCommit], false);
      assert.strictEqual(nextVersion, '2.0.0');
    });

    test('should prioritize major > minor > patch', () => {
      const commits = [fixCommit, featCommit, breakingChangeCommit];
      const nextVersion = calculateNextVersion('1.2.3', commits, false);
      assert.strictEqual(nextVersion, '2.0.0');
    });

    test('should prioritize minor > patch', () => {
      const commits = [fixCommit, featCommit];
      const nextVersion = calculateNextVersion('1.2.3', commits, false);
      assert.strictEqual(nextVersion, '1.3.0');
    });

    test('should return null if no relevant commits are found', () => {
      const nextVersion = calculateNextVersion('1.2.3', [choreCommit], false);
      assert.strictEqual(nextVersion, null);
    });

    test('should handle initial version (0.0.0) correctly', () => {
      assert.strictEqual(calculateNextVersion(null, [fixCommit], false), '0.0.1', 'Initial fix');
      assert.strictEqual(calculateNextVersion(null, [featCommit], false), '0.1.0', 'Initial feat');
      assert.strictEqual(calculateNextVersion(null, [breakingChangeCommit], false), '1.0.0', 'Initial major');
    });

    test('should handle initial version (from package.json) correctly', () => {
        assert.strictEqual(calculateNextVersion('0.0.0', [fixCommit], false), '0.0.1', 'Initial fix from 0.0.0');
        assert.strictEqual(calculateNextVersion('0.0.0', [featCommit], false), '0.1.0', 'Initial feat from 0.0.0');
        assert.strictEqual(calculateNextVersion('0.0.0', [breakingChangeCommit], false), '1.0.0', 'Initial major from 0.0.0');
    });
  });

  describe('calculateNextVersion() - Pre-releases', () => {
    test('should start a new pre-release cycle from a stable version', () => {
      const nextVersion = calculateNextVersion('1.2.3', [fixCommit], 'alpha');
      assert.strictEqual(nextVersion, '1.2.4-alpha.0');
    });

    test('should start a new minor pre-release cycle for a `feat` commit', () => {
      const nextVersion = calculateNextVersion('1.2.3', [featCommit], 'rc');
      assert.strictEqual(nextVersion, '1.3.0-rc.0');
    });

    test('should start a new major pre-release cycle for a BREAKING CHANGE', () => {
      const nextVersion = calculateNextVersion('1.2.3', [breakingChangeCommit], 'beta');
      assert.strictEqual(nextVersion, '2.0.0-beta.0');
    });

    test('should increment an existing pre-release version', () => {
      const nextVersion = calculateNextVersion('1.3.0-alpha.1', [fixCommit], 'alpha');
      assert.strictEqual(nextVersion, '1.3.0-alpha.2');
    });

    test('should bump to a new pre-release if a higher-level change occurs', () => {
      // From a patch-level prerelease, a `feat` commit should bump to minor
      const nextVersion = calculateNextVersion('1.2.4-alpha.3', [featCommit], 'alpha');
      assert.strictEqual(nextVersion, '1.3.0-alpha.0');
    });

    test('should switch to a new pre-release identifier and bump version', () => {
      // Switching from 'alpha' to 'beta' should bump and reset the prerelease counter
      const nextVersion = calculateNextVersion('1.3.0-alpha.5', [fixCommit], 'beta');
      assert.strictEqual(nextVersion, '1.3.0-beta.0');
    });

    test('should create a pre-release even with no relevant commits', () => {
      // Useful for starting a release candidate cycle without new features/fixes
      const nextVersion = calculateNextVersion('1.2.3', [choreCommit], 'rc');
      assert.strictEqual(nextVersion, '1.2.4-rc.0');
    });

    test('should handle initial pre-release from no version', () => {
        const nextVersion = calculateNextVersion(null, [], 'alpha');
        assert.strictEqual(nextVersion, '0.1.0-alpha.0');
    });

    test('should handle initial pre-release from no version with a fix', () => {
        const nextVersion = calculateNextVersion(null, [fixCommit], 'alpha');
        assert.strictEqual(nextVersion, '0.0.1-alpha.0');
    });
  });

  describe('calculateNextVersion() - Graduating from Pre-release to Stable', () => {
    test('should graduate a pre-release to a stable version with no new changes', () => {
      const nextVersion = calculateNextVersion('1.2.4-rc.2', [choreCommit], false);
      assert.strictEqual(nextVersion, '1.2.4');
    });

    test('should graduate a pre-release to a stable version with only patch-level changes', () => {
      const nextVersion = calculateNextVersion('1.3.0-rc.1', [fixCommit], false);
      assert.strictEqual(nextVersion, '1.3.0');
    });

    test('should bump and graduate if a higher-level change is introduced', () => {
      // A BREAKING CHANGE while on a minor pre-release should result in a new major version
      const nextVersion = calculateNextVersion('2.0.0-rc.5', [breakingChangeCommit], false);
      assert.strictEqual(nextVersion, '3.0.0');
    });

    test('should bump and graduate from a patch prerelease to a minor version', () => {
        const nextVersion = calculateNextVersion('1.2.4-alpha.0', [featCommit], false);
        assert.strictEqual(nextVersion, '1.3.0');
    });
  });

  describe('calculateNextVersion() - Edge Cases and Error Handling', () => {
    test('should throw an error for an invalid currentVersion', () => {
      assert.throws(
        () => calculateNextVersion('not-a-version', [fixCommit], false),
        {
          name: 'VersioningError',
          message: "The provided current version 'not-a-version' is not a valid SemVer string.",
        }
      );
    });

    test('should handle an empty commit list gracefully', () => {
      const nextVersion = calculateNextVersion('1.0.0', [], false);
      assert.strictEqual(nextVersion, null);
    });

    test('should handle a version with a "v" prefix by relying on semver.valid', () => {
        // semver.valid() returns the cleaned version if valid, or null otherwise.
        // Our function expects a clean version, so this test confirms behavior with invalid input.
        assert.throws(
            () => calculateNextVersion('v1.2.3', [fixCommit], false),
            { name: 'VersioningError' }
        );
    });

    test('should handle major version zero bumps correctly', () => {
        assert.strictEqual(calculateNextVersion('0.1.0', [fixCommit], false), '0.1.1', 'Patch on 0.x');
        assert.strictEqual(calculateNextVersion('0.1.0', [featCommit], false), '0.2.0', 'Minor on 0.x');
        assert.strictEqual(calculateNextVersion('0.1.0', [breakingChangeCommit], false), '1.0.0', 'Major on 0.x');
    });
  });
});