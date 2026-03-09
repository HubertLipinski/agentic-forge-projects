/**
 * @file test/config-loader.test.js
 * @description Integration tests for the auto-config-loader.
 * This file uses the built-in Node.js test runner and creates a temporary
 * directory structure to simulate a real project environment.
 */

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../src/index.js';
import { ConfigValidationError } from '../src/validator.js';

describe('Integration: Auto-Config Loader', () => {
  let tempDir;
  let projectRoot;
  let nestedDir;
  let originalEnv;
  let originalCwd;

  // --- Test Setup and Teardown ---

  before(async () => {
    // Save original state
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  after(async () => {
    // Restore original state
    process.env = originalEnv;
    process.chdir(originalCwd);
  });

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-config-test-'));
    projectRoot = path.join(tempDir, 'project');
    nestedDir = path.join(projectRoot, 'src', 'app');
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(nestedDir, { recursive: true });

    // Reset environment variables and CWD for isolation
    for (const key in process.env) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    process.chdir(nestedDir);
  });

  afterEach(async () => {
    // Clean up the temporary directory and restore CWD
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // --- Helper Function ---

  /**
   * Helper to write a file with given content.
   * @param {string} filePath - The full path to the file.
   * @param {string} content - The content to write.
   */
  const writeFile = async (filePath, content) => {
    await fs.writeFile(filePath, content, 'utf8');
  };

  // --- Test Cases ---

  test('should load and merge JSON and YAML files correctly', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      db: { host: 'localhost', port: 5432 },
      logLevel: 'info'
    }));
    await writeFile(path.join(nestedDir, 'config.yaml'), 'db:\n  port: 5433\nfeature: true');

    const config = await loadConfig({ startDir: nestedDir });

    assert.strictEqual(config.get('db.host'), 'localhost');
    assert.strictEqual(config.get('db.port'), 5433, 'Nested config should override root');
    assert.strictEqual(config.get('logLevel'), 'info');
    assert.strictEqual(config.get('feature'), true);
  });

  test('should respect NODE_ENV for environment-specific files', async () => {
    process.env.NODE_ENV = 'production';
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      server: { port: 3000 },
      db: 'postgres'
    }));
    await writeFile(path.join(projectRoot, 'config.production.json'), JSON.stringify({
      server: { port: 80, host: 'prod.example.com' }
    }));

    const config = await loadConfig({ startDir: projectRoot });

    assert.strictEqual(config.get('server.port'), 80, 'Production config should override base');
    assert.strictEqual(config.get('server.host'), 'prod.example.com');
    assert.strictEqual(config.get('db'), 'postgres', 'Base config value should be retained');
  });

  test('should load and parse .env files', async () => {
    await writeFile(path.join(projectRoot, '.env'), 'DB_HOST=localhost\nLOG_LEVEL=debug');
    await writeFile(path.join(nestedDir, '.env'), 'DB_HOST=nested.db\nSECRET_KEY=12345');

    const config = await loadConfig({ startDir: nestedDir });

    // .env files are NOT mapped to nested objects unless using prefixed process.env
    assert.strictEqual(config.get('DB_HOST'), 'nested.db', 'Nested .env should override root .env');
    assert.strictEqual(config.get('LOG_LEVEL'), 'debug');
    assert.strictEqual(config.get('SECRET_KEY'), 12345, 'Should coerce type from .env file');
  });

  test('should load and parse environment-specific .env files', async () => {
    process.env.NODE_ENV = 'staging';
    await writeFile(path.join(projectRoot, '.env'), 'API_URL=https://api.example.com\nTIMEOUT=3000');
    await writeFile(path.join(projectRoot, '.env.staging'), 'API_URL=https://api.staging.example.com');

    const config = await loadConfig({ startDir: projectRoot });

    assert.strictEqual(config.get('API_URL'), 'https://api.staging.example.com');
    assert.strictEqual(config.get('TIMEOUT'), 3000);
  });

  test('should parse and merge prefixed environment variables from process.env', async () => {
    process.env.APP__DB__HOST = 'env.db.host';
    process.env.APP__DB__PORT = '5439';
    process.env.APP__FEATURE__NEW_UI = 'true';
    process.env.UNRELATED_VAR = 'should_be_ignored';

    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      db: { host: 'localhost', port: 5432 },
      feature: { old_ui: true }
    }));

    const config = await loadConfig({ startDir: projectRoot, envPrefix: 'APP' });

    assert.strictEqual(config.get('db.host'), 'env.db.host', 'process.env should override file');
    assert.strictEqual(config.get('db.port'), 5439, 'process.env should override file and coerce type');
    assert.strictEqual(config.get('feature.new_ui'), true, 'process.env should add new keys and coerce type');
    assert.strictEqual(config.get('feature.old_ui'), true, 'File value should be retained');
    assert.strictEqual(config.get('UNRELATED_VAR'), undefined, 'Unprefixed var should be ignored');
  });

  test('should apply full precedence chain correctly', async () => {
    // 1. Defaults (lowest precedence)
    const defaults = { db: { user: 'default' }, timeout: 1000 };

    // 2. Home file
    // Note: We simulate the home dir by pointing it to our temp dir for the test
    const homeDir = path.join(tempDir, 'home');
    await fs.mkdir(homeDir);
    await writeFile(path.join(homeDir, '.config.json'), JSON.stringify({
      db: { user: 'home_user', host: 'home.db' },
      theme: 'dark'
    }));
    // Monkey-patch os.homedir for this test
    const originalHomeDirFn = os.homedir;
    os.homedir = () => homeDir;

    // 3. Project files
    await writeFile(path.join(projectRoot, 'config.yml'), 'db:\n  host: project.db\n  port: 5432');
    await writeFile(path.join(nestedDir, 'config.json'), JSON.stringify({ db: { port: 5433 } }));

    // 4. .env files
    await writeFile(path.join(projectRoot, '.env'), 'DB_PORT=9000\nSECRET=from_env_file');

    // 5. process.env (highest precedence)
    process.env.APP__DB__PORT = '9001';
    process.env.APP__DB__REPLICA = 'true';

    const config = await loadConfig({
      startDir: nestedDir,
      defaults,
      envPrefix: 'APP'
    });

    // Assertions
    assert.strictEqual(config.get('db.user'), 'home_user', 'Home file overrides defaults');
    assert.strictEqual(config.get('db.host'), 'project.db', 'Project file overrides home file');
    assert.strictEqual(config.get('theme'), 'dark', 'Value from home file is kept');
    assert.strictEqual(config.get('timeout'), 1000, 'Value from defaults is kept');
    assert.strictEqual(config.get('SECRET'), 'from_env_file', 'Value from .env file is loaded');
    // Note: .env values are not nested, so `DB_PORT` is a top-level key
    assert.strictEqual(config.get('DB_PORT'), 9000, 'Value from .env is loaded and coerced');
    // Prefixed process.env values ARE nested
    assert.strictEqual(config.get('db.port'), 9001, 'process.env overrides all other sources');
    assert.strictEqual(config.get('db.replica'), true, 'process.env adds new keys');

    // Restore homedir function
    os.homedir = originalHomeDirFn;
  });

  test('should throw ConfigValidationError for invalid config against schema', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      server: { host: 127001 }, // Invalid type
      // port is missing
    }));

    const schema = {
      server: {
        host: { type: 'string', required: true },
        port: { type: 'number', required: true },
      },
    };

    await assert.rejects(
      async () => {
        await loadConfig({ startDir: projectRoot, schema });
      },
      (err) => {
        assert(err instanceof ConfigValidationError, 'Error should be a ConfigValidationError');
        assert.strictEqual(err.errors.length, 2);
        assert(err.message.includes("Missing required configuration key: 'server.port'"));
        assert(err.message.includes("Invalid type for configuration key: 'server.host'. Expected string, but got number."));
        return true;
      }
    );
  });

  test('should pass validation for a valid config', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      server: { host: 'localhost', port: 8080 },
    }));

    const schema = {
      server: {
        host: { type: 'string', required: true },
        port: { type: 'number', required: true },
      },
    };

    const config = await loadConfig({ startDir: projectRoot, schema });
    assert.strictEqual(config.get('server.host'), 'localhost');
    assert.strictEqual(config.get('server.port'), 8080);
  });

  test('should handle empty or malformed config files gracefully', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), '{ "db": { "host": "localhost" }'); // Malformed JSON
    await writeFile(path.join(nestedDir, 'config.yml'), 'key: value');
    await writeFile(path.join(nestedDir, 'empty.json'), '');

    // Suppress console.error for this test to keep output clean
    const originalConsoleError = console.error;
    console.error = () => {};

    const config = await loadConfig({ startDir: nestedDir });

    console.error = originalConsoleError; // Restore

    assert.strictEqual(config.get('db.host'), undefined, 'Malformed file should be ignored');
    assert.strictEqual(config.get('key'), 'value', 'Valid file should still be loaded');
    assert.deepStrictEqual({ ...config }, { key: 'value' });
  });

  test('should stop searching at stopDir', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({ root_level: true }));
    await writeFile(path.join(nestedDir, 'config.json'), JSON.stringify({ nested_level: true }));

    const config = await loadConfig({
      startDir: nestedDir,
      stopDir: nestedDir // Stop at the starting directory
    });

    assert.strictEqual(config.get('nested_level'), true);
    assert.strictEqual(config.get('root_level'), undefined, 'Should not have found config in parent dir');
  });

  test('should return an immutable Config object with a working get() method', async () => {
    await writeFile(path.join(projectRoot, 'config.json'), JSON.stringify({
      db: { host: 'localhost' }
    }));

    const config = await loadConfig({ startDir: projectRoot });

    // Test get() method
    assert.strictEqual(config.get('db.host'), 'localhost');
    assert.strictEqual(config.get('db.nonexistent', 'default'), 'default');

    // Test immutability
    assert.throws(() => {
      config.db.host = 'new-host';
    }, TypeError, 'Should throw TypeError on direct modification');

    assert.throws(() => {
      config.newKey = 'test';
    }, TypeError, 'Should throw TypeError on adding new properties');
  });
});