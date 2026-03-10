/**
 * @file test/storage.test.js
 * @description Unit tests for the storage module.
 *
 * These tests verify the functionality of `readState` and `writeState` from
 * `src/state/storage.js`. It uses mocks for the file system (`fs/promises`)
 * and the file locking library (`proper-lockfile`) to isolate the storage
 * logic from actual file I/O and test its behavior in various scenarios.
 */

import { test, describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Module to test
import { readState, writeState, StorageError } from '../src/state/storage.js';

// Mock dependencies
const mockFs = {
  readFile: mock.fn(),
  writeFile: mock.fn(),
  mkdir: mock.fn(),
};

const mockLockfile = {
  lock: mock.fn(),
  unlock: mock.fn(),
};

// Use the mock.module API (available in Node.js 20+) to intercept module loading.
mock.module('node:fs/promises', () => ({ default: mockFs }));
mock.module('proper-lockfile', () => mockLockfile);

const TEST_STORAGE_PATH = path.resolve('/tmp/scheduler-state.json');

describe('storage.js', () => {
  beforeEach(() => {
    // Reset all mocks before each test to ensure isolation.
    mockFs.readFile.mock.reset();
    mockFs.writeFile.mock.reset();
    mockFs.mkdir.mock.reset();
    mockLockfile.lock.mock.reset();
    mockLockfile.unlock.mock.reset();

    // Default successful mock implementations
    mockLockfile.lock.mock.mockImplementation(async () => {});
    mockLockfile.unlock.mock.mockImplementation(async () => {});
    mockFs.mkdir.mock.mockImplementation(async () => {});
  });

  afterEach(() => {
    // Verify that unlock was called for every lock, ensuring no dangling locks.
    assert.strictEqual(
      mockLockfile.lock.mock.callCount(),
      mockLockfile.unlock.mock.callCount(),
      'unlock() should be called once for every lock() call'
    );
  });

  describe('readState()', () => {
    it('should read and parse a valid state file', async () => {
      const state = { jobs: { 'job-1': { id: 'job-1', cronTime: '* * * * *', nextRun: 12345 } } };
      mockFs.readFile.mock.mockImplementation(async () => JSON.stringify(state));

      const result = await readState(TEST_STORAGE_PATH);

      assert.deepStrictEqual(result, state);
      assert.strictEqual(mockLockfile.lock.mock.callCount(), 1);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 1);
      assert.strictEqual(mockFs.readFile.mock.callCount(), 1);
      assert.strictEqual(mockFs.readFile.mock.calls[0].arguments[0], TEST_STORAGE_PATH);
    });

    it('should return a default empty state if the file does not exist (ENOENT)', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockFs.readFile.mock.mockImplementation(async () => { throw error; });

      const result = await readState(TEST_STORAGE_PATH);

      assert.deepStrictEqual(result, { jobs: {} });
      assert.strictEqual(mockLockfile.lock.mock.callCount(), 1);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 1);
    });

    it('should return a default empty state for an empty file', async () => {
      mockFs.readFile.mock.mockImplementation(async () => '');

      const result = await readState(TEST_STORAGE_PATH);

      assert.deepStrictEqual(result, { jobs: {} });
    });

    it('should return a default empty state for a file with only whitespace', async () => {
      mockFs.readFile.mock.mockImplementation(async () => '  \n\t  ');

      const result = await readState(TEST_STORAGE_PATH);

      assert.deepStrictEqual(result, { jobs: {} });
    });

    it('should return a default empty state for a corrupted JSON file', async () => {
      const warnSpy = mock.method(console, 'warn', () => {}); // Suppress console output
      mockFs.readFile.mock.mockImplementation(async () => '{ "jobs": { "job-1": } }'); // Invalid JSON

      const result = await readState(TEST_STORAGE_PATH);

      assert.deepStrictEqual(result, { jobs: {} });
      assert.strictEqual(warnSpy.mock.callCount(), 1, 'A warning should be logged for corrupted JSON');
      assert.ok(warnSpy.mock.calls[0].arguments[0].includes('corrupted or malformed'));
    });

    it('should return a default empty state if parsed JSON lacks the `jobs` property', async () => {
        mockFs.readFile.mock.mockImplementation(async () => '{ "someOtherProp": true }');

        const result = await readState(TEST_STORAGE_PATH);

        assert.deepStrictEqual(result, { jobs: {} });
    });

    it('should throw a StorageError on file read permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      mockFs.readFile.mock.mockImplementation(async () => { throw permissionError; });

      await assert.rejects(
        readState(TEST_STORAGE_PATH),
        (err) => {
          assert.ok(err instanceof StorageError);
          assert.strictEqual(err.message, `Failed to read state file at ${TEST_STORAGE_PATH}`);
          assert.strictEqual(err.cause, permissionError);
          return true;
        }
      );
    });

    it('should throw a StorageError if locking fails', async () => {
      const lockError = new Error('Failed to acquire lock');
      mockLockfile.lock.mock.mockImplementation(async () => { throw lockError; });

      await assert.rejects(
        readState(TEST_STORAGE_PATH),
        (err) => {
          assert.ok(err instanceof StorageError);
          assert.strictEqual(err.message, `Could not acquire lock or read state from ${TEST_STORAGE_PATH}`);
          assert.strictEqual(err.cause, lockError);
          return true;
        }
      );
      // In this case, unlock should not be called as the lock was never acquired.
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 0);
    });

    it('should attempt to unlock even if reading or parsing fails', async () => {
      const parseError = new SyntaxError('Unexpected token');
      mockFs.readFile.mock.mockImplementation(async () => 'invalid json');
      // Mock JSON.parse to throw a specific error we can check for
      const originalParse = JSON.parse;
      const jsonParseMock = mock.fn(originalParse);
      JSON.parse = jsonParseMock;
      jsonParseMock.mock.mockImplementation(() => { throw parseError; });

      const warnSpy = mock.method(console, 'warn', () => {});

      await readState(TEST_STORAGE_PATH);

      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 1, 'Unlock should be called in the finally block');

      // Restore original JSON.parse
      JSON.parse = originalParse;
    });

    it('should log a critical error if unlocking fails', async () => {
      const unlockError = new Error('Failed to release lock');
      mockLockfile.unlock.mock.mockImplementation(async () => { throw unlockError; });
      mockFs.readFile.mock.mockImplementation(async () => '{}');
      const errorSpy = mock.method(console, 'error', () => {}); // Suppress console output

      await readState(TEST_STORAGE_PATH);

      assert.strictEqual(errorSpy.mock.callCount(), 1);
      assert.ok(errorSpy.mock.calls[0].arguments[0].includes('CRITICAL: Failed to release lock'));
      assert.strictEqual(errorSpy.mock.calls[0].arguments[2], unlockError);
    });
  });

  describe('writeState()', () => {
    const state = { jobs: { 'job-1': { id: 'job-1', nextRun: 54321 } } };
    const serializedState = JSON.stringify(state, null, 2);

    it('should serialize and write the state to a file', async () => {
      await writeState(TEST_STORAGE_PATH, state);

      assert.strictEqual(mockLockfile.lock.mock.callCount(), 1);
      assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
      assert.strictEqual(mockFs.writeFile.mock.callCount(), 1);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 1);

      const [filePath, content, encoding] = mockFs.writeFile.mock.calls[0].arguments;
      assert.strictEqual(filePath, TEST_STORAGE_PATH);
      assert.strictEqual(content, serializedState);
      assert.strictEqual(encoding, 'utf-8');
    });

    it('should create the directory if it does not exist', async () => {
        const deepPath = path.resolve('/tmp/deep/nested/path/state.json');
        await writeState(deepPath, state);

        assert.strictEqual(mockFs.mkdir.mock.callCount(), 1);
        const [dirPath, options] = mockFs.mkdir.mock.calls[0].arguments;
        assert.strictEqual(dirPath, path.dirname(deepPath));
        assert.deepStrictEqual(options, { recursive: true });
    });

    it('should throw a StorageError if state serialization fails', async () => {
      const circularState = {};
      circularState.a = { b: circularState }; // Create a circular reference

      await assert.rejects(
        writeState(TEST_STORAGE_PATH, circularState),
        (err) => {
          assert.ok(err instanceof StorageError);
          assert.strictEqual(err.message, 'Failed to serialize scheduler state to JSON');
          assert.ok(err.cause instanceof TypeError); // JSON.stringify throws TypeError for circular structures
          return true;
        }
      );

      // Lock should not have been called if serialization failed first
      assert.strictEqual(mockLockfile.lock.mock.callCount(), 0);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 0);
    });

    it('should throw a StorageError if writing the file fails', async () => {
      const writeError = new Error('Disk full');
      writeError.code = 'ENOSPC';
      mockFs.writeFile.mock.mockImplementation(async () => { throw writeError; });

      await assert.rejects(
        writeState(TEST_STORAGE_PATH, state),
        (err) => {
          assert.ok(err instanceof StorageError);
          assert.strictEqual(err.message, `Could not acquire lock or write state to ${TEST_STORAGE_PATH}`);
          assert.strictEqual(err.cause, writeError);
          return true;
        }
      );

      assert.strictEqual(mockLockfile.lock.mock.callCount(), 1);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 1, 'Unlock should still be called on write failure');
    });

    it('should throw a StorageError if locking fails', async () => {
      const lockError = new Error('Failed to acquire lock');
      mockLockfile.lock.mock.mockImplementation(async () => { throw lockError; });

      await assert.rejects(
        writeState(TEST_STORAGE_PATH, state),
        (err) => {
          assert.ok(err instanceof StorageError);
          assert.strictEqual(err.message, `Could not acquire lock or write state to ${TEST_STORAGE_PATH}`);
          assert.strictEqual(err.cause, lockError);
          return true;
        }
      );

      assert.strictEqual(mockLockfile.lock.mock.callCount(), 1);
      assert.strictEqual(mockFs.writeFile.mock.callCount(), 0);
      assert.strictEqual(mockLockfile.unlock.mock.callCount(), 0, 'Unlock is not called if lock fails');
    });

    it('should log a critical error if unlocking fails after a successful write', async () => {
      const unlockError = new Error('Failed to release lock');
      mockLockfile.unlock.mock.mockImplementation(async () => { throw unlockError; });
      const errorSpy = mock.method(console, 'error', () => {});

      await writeState(TEST_STORAGE_PATH, state);

      assert.strictEqual(mockFs.writeFile.mock.callCount(), 1);
      assert.strictEqual(errorSpy.mock.callCount(), 1);
      assert.ok(errorSpy.mock.calls[0].arguments[0].includes('CRITICAL: Failed to release lock on'));
      assert.strictEqual(errorSpy.mock.calls[0].arguments[1], unlockError);
    });
  });
});