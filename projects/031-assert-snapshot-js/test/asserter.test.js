import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';

// Mock dependencies before importing the module under test
const fsMock = {
  fileExists: mock.fn(),
  readSnapshotFile: mock.fn(),
  writeSnapshotFile: mock.fn(),
};
mock.method(fsMock, 'writeSnapshotFile', () => Promise.resolve()); // Default happy path

const cliParserMock = {
  isUpdateMode: mock.fn(),
};

const configMock = {
  getConfig: mock.fn(),
};

// Use mock.module to replace dependencies for the module being imported next
mock.module('../src/utils/fs.js', () => ({
  fileExists: fsMock.fileExists,
  readSnapshotFile: fsMock.readSnapshotFile,
  writeSnapshotFile: fsMock.writeSnapshotFile,
}));

mock.module('../src/utils/cli-parser.js', () => ({
  isUpdateMode: cliParserMock.isUpdateMode,
}));

mock.module('../src/config.js', () => ({
  getConfig: configMock.getConfig,
}));

// Now, import the module to be tested. It will receive the mocked dependencies.
const { assertSnapshot } = await import('../src/asserter.js');

describe('asserter.js', () => {
  beforeEach(() => {
    // Reset mocks and default behaviors before each test
    fsMock.fileExists.mock.reset();
    fsMock.readSnapshotFile.mock.reset();
    fsMock.writeSnapshotFile.mock.reset();
    cliParserMock.isUpdateMode.mock.reset();
    configMock.getConfig.mock.reset();

    // Default mock implementations
    cliParserMock.isUpdateMode.mock.mockImplementation(() => false);
    configMock.getConfig.mock.mockImplementation(() => ({
      snapshotDir: '__snapshots__',
      snapshotFileExtension: '.snap',
    }));
  });

  afterEach(() => {
    // Verify that all mocks were called as expected (optional, but good practice)
    assert.strictEqual(fsMock.fileExists.mock.callCount(), 1, 'fileExists should be called once per test');
    assert.strictEqual(configMock.getConfig.mock.callCount(), 1, 'getConfig should be called once per test');
  });

  describe('Input Validation', () => {
    // In validation tests, fs/config mocks are not called, so we adjust the afterEach check.
    afterEach(() => {
      fsMock.fileExists.mock.reset();
      configMock.getConfig.mock.reset();
    });

    test('should throw if testName is not a string', async () => {
      await assert.rejects(
        () => assertSnapshot({ a: 1 }, null),
        {
          name: 'Error',
          message: 'assertSnapshot requires a non-empty string for the test name.',
        }
      );
    });

    test('should throw if testName is an empty string', async () => {
      await assert.rejects(
        () => assertSnapshot({ a: 1 }, '  '),
        {
          name: 'Error',
          message: 'assertSnapshot requires a non-empty string for the test name.',
        }
      );
    });

    test('should throw if testName contains invalid file path characters', async () => {
      const invalidName = 'test/with/slashes';
      await assert.rejects(
        () => assertSnapshot({ a: 1 }, invalidName),
        {
          name: 'Error',
          message: `Invalid characters found in test name: "${invalidName}". Please use a valid filename-safe string.`,
        }
      );
    });
  });

  describe('Snapshot Creation (File does not exist)', () => {
    test('should create a new snapshot if one does not exist', async () => {
      const receivedValue = { id: 1, name: 'Test' };
      const testName = 'new-snapshot-test';
      const expectedPath = path.resolve(process.cwd(), '__snapshots__', `${testName}.snap`);
      const expectedContent = '{\n  "id": 1,\n  "name": "Test"\n}';

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(false));

      await assertSnapshot(receivedValue, testName);

      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 1, 'writeSnapshotFile should be called');
      const [actualPath, actualContent] = fsMock.writeSnapshotFile.mock.calls[0].arguments;
      assert.strictEqual(actualPath, expectedPath);
      assert.strictEqual(actualContent, expectedContent);
      assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 0, 'readSnapshotFile should not be called');
    });
  });

  describe('Snapshot Matching (File exists)', () => {
    test('should pass if received value matches the snapshot', async () => {
      const value = { id: 2, data: ['a', 'b'] };
      const testName = 'matching-snapshot-test';
      const snapshotContent = JSON.stringify(value, null, 2);

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(true));
      fsMock.readSnapshotFile.mock.mockImplementationOnce(() => Promise.resolve(snapshotContent));

      await assert.doesNotReject(() => assertSnapshot(value, testName));

      assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 1, 'readSnapshotFile should be called');
      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 0, 'writeSnapshotFile should not be called');
    });

    test('should throw AssertionError if received value does not match', async () => {
      const receivedValue = { id: 3, status: 'updated' };
      const expectedValue = { id: 3, status: 'initial' };
      const testName = 'mismatch-snapshot-test';
      const snapshotContent = JSON.stringify(expectedValue, null, 2);

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(true));
      fsMock.readSnapshotFile.mock.mockImplementationOnce(() => Promise.resolve(snapshotContent));

      await assert.rejects(
        () => assertSnapshot(receivedValue, testName),
        (err) => {
          assert.strictEqual(err.name, 'AssertionError');
          assert.strictEqual(err.code, 'ERR_ASSERTION');
          assert.deepStrictEqual(err.actual, receivedValue);
          assert.deepStrictEqual(err.expected, expectedValue);
          assert.match(err.message, /Snapshot mismatch for test/);
          assert.match(err.message, /Run with the '--update-snapshots' or '-u' flag/);
          return true;
        }
      );

      assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 1);
      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 0);
    });
  });

  describe('Snapshot Update Mode (-u flag)', () => {
    beforeEach(() => {
      cliParserMock.isUpdateMode.mock.mockImplementation(() => true);
    });

    test('should update snapshot if value mismatches and update mode is on', async () => {
      const newValue = { version: 2, active: true };
      const oldValue = { version: 1, active: false };
      const testName = 'update-mode-test';
      const oldSnapshotContent = JSON.stringify(oldValue, null, 2);
      const newSnapshotContent = '{\n  "active": true,\n  "version": 2\n}'; // Formatted and sorted
      const expectedPath = path.resolve(process.cwd(), '__snapshots__', `${testName}.snap`);

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(true));
      fsMock.readSnapshotFile.mock.mockImplementationOnce(() => Promise.resolve(oldSnapshotContent));

      await assert.doesNotReject(() => assertSnapshot(newValue, testName));

      assert.strictEqual(cliParserMock.isUpdateMode.mock.callCount(), 1, 'isUpdateMode should be checked');
      assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 1);
      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 1, 'writeSnapshotFile should be called to update');

      const [actualPath, actualContent] = fsMock.writeSnapshotFile.mock.calls[0].arguments;
      assert.strictEqual(actualPath, expectedPath);
      assert.strictEqual(actualContent, newSnapshotContent);
    });

    test('should not write to file if value matches in update mode', async () => {
      const value = { id: 4, stable: true };
      const testName = 'update-mode-no-change-test';
      const snapshotContent = JSON.stringify(value, null, 2);

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(true));
      fsMock.readSnapshotFile.mock.mockImplementationOnce(() => Promise.resolve(snapshotContent));

      await assert.doesNotReject(() => assertSnapshot(value, testName));

      assert.strictEqual(cliParserMock.isUpdateMode.mock.callCount(), 1);
      assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 1);
      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 0, 'writeSnapshotFile should not be called if content matches');
    });

    test('should create snapshot if it does not exist, even in update mode', async () => {
        const receivedValue = { id: 5, name: 'New In Update Mode' };
        const testName = 'new-in-update-mode';
        const expectedContent = '{\n  "id": 5,\n  "name": "New In Update Mode"\n}';
  
        fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(false));
  
        await assertSnapshot(receivedValue, testName);
  
        assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 1, 'writeSnapshotFile should be called');
        const [, actualContent] = fsMock.writeSnapshotFile.mock.calls[0].arguments;
        assert.strictEqual(actualContent, expectedContent);
        assert.strictEqual(fsMock.readSnapshotFile.mock.callCount(), 0);
    });
  });

  describe('Configuration', () => {
    test('should use custom snapshot directory and extension from config', async () => {
      configMock.getConfig.mock.mockImplementationOnce(() => ({
        snapshotDir: 'test/custom_snapshots',
        snapshotFileExtension: '.customsnap',
      }));

      const receivedValue = { config: 'custom' };
      const testName = 'custom-config-test';
      const expectedPath = path.resolve(process.cwd(), 'test/custom_snapshots', `${testName}.customsnap`);

      fsMock.fileExists.mock.mockImplementationOnce(() => Promise.resolve(false));

      await assertSnapshot(receivedValue, testName);

      assert.strictEqual(fsMock.writeSnapshotFile.mock.callCount(), 1);
      const [actualPath] = fsMock.writeSnapshotFile.mock.calls[0].arguments;
      assert.strictEqual(actualPath, expectedPath);
    });
  });
});