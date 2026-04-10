/**
 * @file tests/config.test.js
 * @description Unit tests for the configuration loader and validator.
 *
 * This test suite covers the functionality of `src/config/loader.js` and `src/config/validator.js`.
 * It ensures that:
 * 1. The validator correctly identifies valid and invalid configuration schemas.
 * 2. The loader can read, parse, and validate a configuration file.
 * 3. The loader handles file system errors (e.g., file not found) gracefully.
 * 4. The loader handles YAML parsing errors.
 * 5. Default values for rules are applied correctly.
 * 6. Edge cases like empty files or files with only comments are handled.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { stub } from 'sinon';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config/validator.js';
import { loadConfig } from '../src/config/loader.js';
import logger from '../src/utils/logger.js';

// Suppress logger output during tests to keep the console clean.
beforeEach(() => {
  stub(logger, 'info');
  stub(logger, 'success');
  stub(logger, 'warn');
  stub(logger, 'error');
  stub(logger, 'log');
});

afterEach(() => {
  logger.info.restore();
  logger.success.restore();
  logger.warn.restore();
  logger.error.restore();
  logger.log.restore();
});

describe('Config Validator (validateConfig)', () => {
  it('should return valid for a correct and complete configuration', () => {
    const config = {
      rules: [
        {
          when: ['author:dependabot[bot]', 'label:dependencies'],
          merge: 'squash',
          checks: 'stable',
        },
        {
          when: ['label:auto-merge'],
          merge: 'merge',
          checks: 'all',
        },
      ],
    };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, true, 'Configuration should be valid');
    assert.deepStrictEqual(errors, [], 'There should be no errors');
  });

  it('should return valid for a configuration with minimal rules', () => {
    const config = {
      rules: [{ when: ['author:test-user'] }],
    };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, true, 'Minimal configuration should be valid');
    assert.deepStrictEqual(errors, [], 'There should be no errors');
  });

  it('should return valid but warn when rules array is empty', () => {
    const config = { rules: [] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, true, 'Config with empty rules should be valid');
    assert.deepStrictEqual(errors, [], 'There should be no errors');
    assert.strictEqual(logger.warn.calledOnce, true, 'A warning should be logged for empty rules');
  });

  it('should return invalid if config is not an object', () => {
    const { isValid, errors } = validateConfig('not an object');
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ['Configuration must be a YAML object.']);
  });

  it('should return invalid if top-level "rules" key is missing', () => {
    const config = { otherKey: [] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ["Configuration must contain a top-level 'rules' key with an array of merge rules."]);
  });

  it('should return invalid if "rules" is not an array', () => {
    const config = { rules: 'not an array' };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ["Configuration must contain a top-level 'rules' key with an array of merge rules."]);
  });

  it('should return invalid if a rule is not an object', () => {
    const config = { rules: ['not an object'] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ['Rule #1 must be an object.']);
  });

  it('should return invalid if "when" condition is missing or not an array of strings', () => {
    const config1 = { rules: [{ merge: 'squash' }] }; // Missing 'when'
    const { isValid: isValid1, errors: errors1 } = validateConfig(config1);
    assert.strictEqual(isValid1, false);
    assert.deepStrictEqual(errors1, ["Rule #1: 'when' condition must be an array of strings (labels, author, etc.)."]);

    const config2 = { rules: [{ when: 'not an array' }] }; // 'when' is not an array
    const { isValid: isValid2, errors: errors2 } = validateConfig(config2);
    assert.strictEqual(isValid2, false);
    assert.deepStrictEqual(errors2, ["Rule #1: 'when' condition must be an array of strings (labels, author, etc.)."]);

    const config3 = { rules: [{ when: [123] }] }; // 'when' contains non-string
    const { isValid: isValid3, errors: errors3 } = validateConfig(config3);
    assert.strictEqual(isValid3, false);
    assert.deepStrictEqual(errors3, ["Rule #1: 'when' condition must be an array of strings (labels, author, etc.)."]);
  });

  it('should return invalid if "when" condition is an empty array', () => {
    const config = { rules: [{ when: [] }] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ["Rule #1: 'when' condition cannot be an empty array."]);
  });

  it('should return invalid for an invalid merge strategy', () => {
    const config = { rules: [{ when: ['label:a'], merge: 'invalid-strategy' }] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ["Rule #1: 'merge' strategy must be one of [merge, squash, rebase]. Found 'invalid-strategy'."]);
  });

  it('should return invalid for an invalid checks policy', () => {
    const config = { rules: [{ when: ['label:a'], checks: 'invalid-policy' }] };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, ["Rule #1: 'checks' policy must be one of [all, stable]. Found 'invalid-policy'."]);
  });

  it('should collect errors from multiple invalid rules', () => {
    const config = {
      rules: [
        { when: ['author:test'] }, // Valid rule
        { when: ['label:b'], merge: 'invalid' }, // Invalid merge
        { when: [] }, // Empty 'when'
      ],
    };
    const { isValid, errors } = validateConfig(config);
    assert.strictEqual(isValid, false);
    assert.deepStrictEqual(errors, [
      "Rule #2: 'merge' strategy must be one of [merge, squash, rebase]. Found 'invalid'.",
      "Rule #3: 'when' condition cannot be an empty array.",
    ]);
  });
});

describe('Config Loader (loadConfig)', () => {
  let readFileStub;

  beforeEach(() => {
    // Stub fs.readFile to avoid actual file system access
    readFileStub = stub(global, 'readFile');
  });

  afterEach(() => {
    readFileStub.restore();
  });

  it('should load, parse, and validate a correct config file', async () => {
    const yamlContent = `
rules:
  - when:
      - "author:dependabot[bot]"
    merge: squash
  - when:
      - "label:auto-merge"
`;
    readFileStub.resolves(yamlContent);

    const config = await loadConfig('dummy/path.yml');

    assert.ok(config, 'Config should be loaded');
    assert.strictEqual(config.rules.length, 2);
    assert.strictEqual(logger.success.calledWith('Configuration loaded and validated successfully.'), true);
  });

  it('should apply default values for merge strategy and checks policy', async () => {
    const yamlContent = `
rules:
  - when:
      - "author:dependabot[bot]"
  - when:
      - "label:auto-merge"
    merge: squash
  - when:
      - "branch:hotfix/*<-main"
    checks: all
`;
    readFileStub.resolves(yamlContent);

    const config = await loadConfig('dummy/path.yml');

    assert.ok(config, 'Config should be loaded');
    assert.strictEqual(config.rules.length, 3);

    // Rule 1: Should have both defaults
    assert.strictEqual(config.rules[0].merge, 'merge');
    assert.strictEqual(config.rules[0].checks, 'stable');

    // Rule 2: Should have default 'checks'
    assert.strictEqual(config.rules[1].merge, 'squash');
    assert.strictEqual(config.rules[1].checks, 'stable');

    // Rule 3: Should have default 'merge'
    assert.strictEqual(config.rules[2].merge, 'merge');
    assert.strictEqual(config.rules[2].checks, 'all');
  });

  it('should return null and log error if file not found', async () => {
    const error = new Error('File not found');
    error.code = 'ENOENT';
    readFileStub.rejects(error);

    const config = await loadConfig('nonexistent/path.yml');

    assert.strictEqual(config, null);
    assert.strictEqual(logger.error.calledOnce, true);
    assert.ok(logger.error.firstCall.args[0].includes('Configuration file not found at path:'));
  });

  it('should return null and log error for other file read errors', async () => {
    const error = new Error('Permission denied');
    error.code = 'EACCES';
    readFileStub.rejects(error);

    const config = await loadConfig('unreadable/path.yml');

    assert.strictEqual(config, null);
    assert.strictEqual(logger.error.calledOnce, true);
    assert.ok(logger.error.firstCall.args[0].includes('Failed to read configuration file:'));
  });

  it('should return null and log error for invalid YAML syntax', async () => {
    const invalidYaml = 'rules: \n  - when: ["label:a"]\n- key: value'; // Bad indentation
    readFileStub.resolves(invalidYaml);

    const config = await loadConfig('invalid.yml');

    assert.strictEqual(config, null);
    assert.strictEqual(logger.error.calledOnce, true);
    assert.ok(logger.error.firstCall.args[0].includes('Failed to parse YAML'));
  });

  it('should return null and log error for empty or commented-out file', async () => {
    const emptyContent = '# This file is all comments';
    readFileStub.resolves(emptyContent);

    const config = await loadConfig('empty.yml');

    assert.strictEqual(config, null);
    assert.strictEqual(logger.error.calledOnce, true);
    assert.strictEqual(logger.error.firstCall.args[0], 'Configuration file is empty or contains only comments.');
  });

  it('should return null and log errors for an invalid schema', async () => {
    const invalidSchemaYaml = `
rules:
  - when: [] # Invalid empty 'when'
`;
    readFileStub.resolves(invalidSchemaYaml);

    const config = await loadConfig('invalid-schema.yml');

    assert.strictEqual(config, null);
    assert.strictEqual(logger.error.calledWith('Configuration validation failed with the following errors:'), true);
  });
});