/**
 * @file tests/cli.test.js
 * @description Integration tests for the command-line interface.
 * This file uses the built-in Node.js test runner and `child_process` to execute
 * the CLI script against sample data files and verify its behavior.
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

// --- Test Setup ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, 'temp-cli-test-data');
const cliScriptPath = path.join(__dirname, '..', 'bin', 'infer-schema.js');

const sampleData = {
  singleObject: {
    name: 'Test Product',
    price: 19.99,
    tags: ['a', 'b'],
    inStock: true,
  },
  arrayOfObjects: [
    { id: 1, user: 'alice', role: 'admin' },
    { id: 2, user: 'bob', role: 'editor', lastLogin: '2024-01-01T12:00:00Z' },
    { id: 3, user: 'charlie', role: 'viewer' },
  ],
  invalidJson: '{ "key": "value", }', // trailing comma
};

const filePaths = {
  single: path.join(tempDir, 'single.json'),
  array: path.join(tempDir, 'array.json'),
  invalid: path.join(tempDir, 'invalid.json'),
  output: path.join(tempDir, 'output.schema.json'),
};

/**
 * Helper function to run the CLI command.
 * @param {string} args - Command line arguments.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runCli(args) {
  return execPromise(`node ${cliScriptPath} ${args}`);
}

before(async () => {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(filePaths.single, JSON.stringify(sampleData.singleObject));
    await fs.writeFile(filePaths.array, JSON.stringify(sampleData.arrayOfObjects));
    await fs.writeFile(filePaths.invalid, sampleData.invalidJson);
  } catch (error) {
    console.error('Failed to set up test environment:', error);
    process.exit(1);
  }
});

after(async () => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to clean up test environment:', error);
  }
});

// --- Test Suites ---

describe('CLI Integration Tests', () => {
  it('should show version information with -v flag', async () => {
    const { stdout } = await runCli('-v');
    // Assuming version is 1.0.0 from package.json
    assert.match(stdout, /1\.0\.0/);
  });

  it('should show help information with --help flag', async () => {
    const { stdout } = await runCli('--help');
    assert.match(stdout, /Usage: infer-schema \[options\] <input-file>/);
    assert.match(stdout, /Path to the input JSON file/);
    assert.match(stdout, /-o, --output <file>/);
  });

  it('should print an error for a non-existent input file', async () => {
    const promise = runCli('non-existent-file.json');
    await assert.rejects(promise, (err) => {
      assert.match(err.stderr, /Error: Input file not found/);
      return true;
    });
  });

  it('should print an error for an invalid JSON input file', async () => {
    const promise = runCli(filePaths.invalid);
    await assert.rejects(promise, (err) => {
      assert.match(err.stderr, /Error: Invalid JSON in file/);
      return true;
    });
  });

  describe('Standard Output (stdout)', () => {
    it('should infer schema from a single object and print to stdout', async () => {
      const { stdout } = await runCli(filePaths.single);
      const schema = JSON.parse(stdout);

      assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.strictEqual(schema.type, 'object');
      assert.deepStrictEqual(Object.keys(schema.properties).sort(), ['inStock', 'name', 'price', 'tags']);
      assert.strictEqual(schema.properties.price.type, 'number');
      assert.strictEqual(schema.properties.tags.items.type, 'string');
    });

    it('should infer schema from an array of objects and print to stdout', async () => {
      const { stdout } = await runCli(filePaths.array);
      const schema = JSON.parse(stdout);

      assert.strictEqual(schema.type, 'object');
      assert.deepStrictEqual(Object.keys(schema.properties).sort(), ['id', 'lastLogin', 'role', 'user']);
      // 'id', 'user', 'role' are required as they appear in all objects
      assert.deepStrictEqual(schema.required, ['id', 'role', 'user']);
      // 'lastLogin' is optional
      assert.strictEqual(schema.properties.lastLogin.type, 'string');
      assert.strictEqual(schema.properties.id.type, 'integer');
    });

    it('should use a custom indentation level when printing to stdout', async () => {
      const { stdout } = await runCli(`${filePaths.single} --indent 4`);
      // Check for 4 spaces of indentation on a property
      assert.match(stdout, /\n {4}"name":/);
      const schema = JSON.parse(stdout); // Ensure it's still valid JSON
      assert.ok(schema.properties.name);
    });
  });

  describe('File Output (-o, --output)', () => {
    // Clean up the output file before each test in this suite
    before(async () => {
      try {
        await fs.unlink(filePaths.output);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error; // Ignore if file doesn't exist
      }
    });

    it('should infer schema and write to an output file', async () => {
      const { stderr } = await runCli(`${filePaths.array} -o ${filePaths.output}`);
      assert.match(stderr, /Schema successfully written to/);

      const fileContent = await fs.readFile(filePaths.output, 'utf-8');
      const schema = JSON.parse(fileContent);

      assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.strictEqual(schema.type, 'object');
      assert.deepStrictEqual(schema.required, ['id', 'role', 'user']);
      assert.ok(schema.properties.lastLogin);
    });

    it('should use default indentation (2 spaces) in the output file', async () => {
      await runCli(`${filePaths.single} --output ${filePaths.output}`);
      const fileContent = await fs.readFile(filePaths.output, 'utf-8');
      // Check for 2 spaces of indentation
      assert.match(fileContent, /\n  "name":/);
    });

    it('should fail gracefully if the output file is not writable', async () => {
      // On POSIX systems, we can create a read-only directory to test this.
      if (process.platform !== 'win32') {
        const readOnlyDir = path.join(tempDir, 'read-only');
        const unwritablePath = path.join(readOnlyDir, 'schema.json');
        await fs.mkdir(readOnlyDir, { mode: 0o555 }); // r-x r-x r-x

        const promise = runCli(`${filePaths.single} -o ${unwritablePath}`);
        await assert.rejects(promise, (err) => {
          assert.match(err.stderr, /Error: Could not write to output file/);
          assert.match(err.stderr, /EACCES: permission denied/);
          return true;
        });

        // Cleanup the read-only dir
        await fs.chmod(readOnlyDir, 0o755);
      } else {
        // Skipping this specific test on Windows as file permissions are more complex.
        test.skip('Write permission test skipped on Windows');
      }
    });
  });
});