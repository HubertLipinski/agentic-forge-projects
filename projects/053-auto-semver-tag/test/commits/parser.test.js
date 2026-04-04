import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { getAndParseCommits } from '../../src/commits/parser.js';
import * as gitWrapper from '../../src/git/wrapper.js';
import logger from '../../src/ui/logger.js';

// Mock the logger to prevent console output during tests
const loggerMock = {
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  verbose: mock.fn(),
};
mock.method(logger, 'info', loggerMock.info);
mock.method(logger, 'warn', loggerMock.warn);
mock.method(logger, 'error', loggerMock.error);

// Mock the git wrapper to isolate the parser from actual Git commands
const getCommitLogMock = mock.method(gitWrapper, 'getCommitLog', async () => '');

afterEach(() => {
  getCommitLogMock.mock.reset();
  loggerMock.info.mock.reset();
  loggerMock.warn.mock.reset();
  loggerMock.error.mock.reset();
});

// --- Test Data ---
const COMMIT_BOUNDARY = '\n\n--GIT-COMMIT-BOUNDARY--';

const simpleFix = `fix: correct a typo in the documentation`;
const featWithScope = `feat(api): add new endpoint for users`;
const commitWithBody = `refactor: simplify the main loop\n\nThis change reduces complexity by removing a nested loop and using a more efficient data structure.`;
const breakingChangeNote = `feat: change authentication mechanism\n\nBREAKING CHANGE: The 'token' parameter is now required for all API calls.`;
const multiLineBreakingChange = `perf(db)!: switch to a new database engine\n\nThis improves query performance by over 50%.\n\nBREAKING-CHANGE: All database connection strings must be updated to the new format. The old driver is no longer supported.`;
const nonConventionalCommit = `Update README.md`;
const choreCommit = `chore: update dependencies`;
const commitWithFooter = `fix: resolve issue with session handling\n\nCloses: #123\nReviewed-by: Jane Doe`;

const fullLog = [
  simpleFix,
  featWithScope,
  commitWithBody,
  breakingChangeNote,
  multiLineBreakingChange,
  nonConventionalCommit,
  choreCommit,
  commitWithFooter,
].join(COMMIT_BOUNDARY);


describe('commits/parser.js', () => {
  describe('getAndParseCommits()', () => {
    test('should call getCommitLog with the provided tag', async () => {
      getCommitLogMock.mock.mockImplementation(async () => fullLog);
      await getAndParseCommits('v1.0.0');
      assert.strictEqual(getCommitLogMock.mock.callCount(), 1, 'getCommitLog should be called once');
      assert.strictEqual(getCommitLogMock.mock.calls[0].arguments[0], 'v1.0.0', 'getCommitLog should be called with the correct tag');
    });

    test('should call getCommitLog with null if no tag is provided', async () => {
      getCommitLogMock.mock.mockImplementation(async () => fullLog);
      await getAndParseCommits(null);
      assert.strictEqual(getCommitLogMock.mock.callCount(), 1, 'getCommitLog should be called once');
      assert.strictEqual(getCommitLogMock.mock.calls[0].arguments[0], null, 'getCommitLog should be called with null');
    });

    test('should return an empty array if git log is empty', async () => {
      getCommitLogMock.mock.mockImplementation(async () => '');
      const commits = await getAndParseCommits('v1.0.0');
      assert.deepStrictEqual(commits, []);
      assert.strictEqual(loggerMock.warn.mock.callCount(), 1, 'Should warn about no new commits');
    });

    test('should return an empty array if git log contains only whitespace', async () => {
      getCommitLogMock.mock.mockImplementation(async () => ' \n \t ');
      const commits = await getAndParseCommits('v1.0.0');
      assert.deepStrictEqual(commits, []);
      assert.strictEqual(loggerMock.warn.mock.callCount(), 1, 'Should warn about no new commits');
    });

    test('should filter out non-conventional commits', async () => {
      getCommitLogMock.mock.mockImplementation(async () => fullLog);
      const commits = await getAndParseCommits('v1.0.0');
      const nonConventional = commits.find(c => c.raw === nonConventionalCommit);
      assert.strictEqual(nonConventional, undefined, 'Non-conventional commits should be filtered out');
      assert.strictEqual(commits.length, 7, 'Should parse 7 conventional commits from the log');
    });

    test('should correctly parse a simple `fix` commit', async () => {
      getCommitLogMock.mock.mockImplementation(async () => simpleFix);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.type, 'fix');
      assert.strictEqual(commit.scope, null);
      assert.strictEqual(commit.subject, 'correct a typo in the documentation');
      assert.strictEqual(commit.body, null);
      assert.strictEqual(commit.footer, null);
    });

    test('should correctly parse a `feat` commit with a scope', async () => {
      getCommitLogMock.mock.mockImplementation(async () => featWithScope);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.type, 'feat');
      assert.strictEqual(commit.scope, 'api');
      assert.strictEqual(commit.subject, 'add new endpoint for users');
    });

    test('should correctly parse a commit with a body', async () => {
      getCommitLogMock.mock.mockImplementation(async () => commitWithBody);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.type, 'refactor');
      assert.strictEqual(commit.body, 'This change reduces complexity by removing a nested loop and using a more efficient data structure.');
    });

    test('should correctly parse a BREAKING CHANGE note', async () => {
      getCommitLogMock.mock.mockImplementation(async () => breakingChangeNote);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.notes.length, 1);
      assert.strictEqual(commit.notes[0].title, 'BREAKING CHANGE');
      assert.strictEqual(commit.notes[0].text, `The 'token' parameter is now required for all API calls.`);
    });

    test('should correctly parse a BREAKING-CHANGE note with `!` syntax', async () => {
      getCommitLogMock.mock.mockImplementation(async () => multiLineBreakingChange);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.notes.length, 1);
      assert.strictEqual(commit.notes[0].title, 'BREAKING-CHANGE');
      assert.strictEqual(commit.notes[0].text.startsWith('All database connection strings'), true);
    });

    test('should correctly parse a commit with a footer', async () => {
      getCommitLogMock.mock.mockImplementation(async () => commitWithFooter);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.footer, 'Closes: #123\nReviewed-by: Jane Doe');
    });

    test('should include the raw commit message in the parsed object', async () => {
      getCommitLogMock.mock.mockImplementation(async () => featWithScope);
      const [commit] = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commit.raw, featWithScope);
    });

    test('should handle a mix of all commit types correctly', async () => {
      getCommitLogMock.mock.mockImplementation(async () => fullLog);
      const commits = await getAndParseCommits('v1.0.0');
      assert.strictEqual(commits.length, 7);
      assert.ok(commits.some(c => c.type === 'fix' && c.subject === 'correct a typo in the documentation'));
      assert.ok(commits.some(c => c.type === 'feat' && c.scope === 'api'));
      assert.ok(commits.some(c => c.type === 'refactor' && c.body));
      assert.ok(commits.some(c => c.notes.length > 0 && c.notes[0].title === 'BREAKING CHANGE'));
      assert.ok(commits.some(c => c.notes.length > 0 && c.notes[0].title === 'BREAKING-CHANGE'));
      assert.ok(commits.some(c => c.type === 'chore'));
      assert.ok(commits.some(c => c.footer?.includes('Closes: #123')));
    });

    test('should propagate GitError from getCommitLog', async () => {
      const gitError = new Error('fatal: not a git repository');
      gitError.name = 'GitError';
      getCommitLogMock.mock.mockImplementation(async () => { throw gitError; });

      await assert.rejects(
        async () => await getAndParseCommits('v1.0.0'),
        {
          name: 'GitError',
          message: 'fatal: not a git repository',
        }
      );
    });

    test('should wrap unexpected errors in a CommitParseError', async () => {
      const unexpectedError = new Error('Something went wrong');
      getCommitLogMock.mock.mockImplementation(async () => { throw unexpectedError; });

      await assert.rejects(
        async () => await getAndParseCommits('v1.0.0'),
        {
          name: 'CommitParseError',
          message: 'An unexpected error occurred while getting and parsing commits: Something went wrong',
          cause: unexpectedError,
        }
      );
    });

    test('should handle stream errors during parsing', async () => {
        // This is harder to test directly without mocking the stream itself,
        // but we can simulate a bad input that might cause the parser to fail.
        // The conventional-commits-parser is quite robust, so we'll test the error path.
        const badLog = 'fix: this is fine' + COMMIT_BOUNDARY + 'feat(scope: this is broken';
        getCommitLogMock.mock.mockImplementation(async () => badLog);

        // The parser is resilient and may not throw, but it will log warnings.
        // The main goal is to ensure our wrapper doesn't crash.
        const commits = await getAndParseCommits('v1.0.0');
        assert.strictEqual(commits.length, 1, 'Should parse valid commits even if others are malformed');
        assert.strictEqual(commits[0].type, 'fix');
    });
  });
});