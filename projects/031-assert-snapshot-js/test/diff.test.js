/**
 * @fileoverview Unit tests for the diffing utility (`src/utils/diff.js`).
 * These tests verify that the `generateDiff` function correctly identifies
 * differences between various JavaScript data structures and produces a
 * human-readable, colorized diff string.
 *
 * Note: These tests do not check for exact ANSI color codes, as `chalk`
 * can be disabled by environment variables (e.g., in CI). Instead, we
 * use `chalk.level = 1` to force basic colorization and then check for the
 * presence of expected substrings and structure.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import chalk from 'chalk';
import { generateDiff } from '../src/utils/diff.js';

describe('diff.js - generateDiff()', () => {
  let originalChalkLevel;

  before(() => {
    // Force chalk to produce color codes for testing purposes,
    // even in environments where it might auto-disable (like some CIs).
    originalChalkLevel = chalk.level;
    chalk.level = 1; // Enable basic 16-color support.
  });

  after(() => {
    // Restore the original chalk level to avoid side effects.
    chalk.level = originalChalkLevel;
  });

  test('should return an empty string for identical objects', () => {
    const obj1 = { a: 1, b: { c: 'hello' }, d: [1, 2, 3] };
    const obj2 = { a: 1, b: { c: 'hello' }, d: [1, 2, 3] };
    const diff = generateDiff(obj1, obj2);
    assert.strictEqual(diff, '', 'Expected no diff for identical objects');
  });

  test('should return an empty string for identical primitives', () => {
    assert.strictEqual(generateDiff(123, 123), '');
    assert.strictEqual(generateDiff('hello', 'hello'), '');
    assert.strictEqual(generateDiff(true, true), '');
    assert.strictEqual(generateDiff(null, null), '');
    assert.strictEqual(generateDiff(undefined, undefined), '');
  });

  test('should return an empty string for objects with same properties in different order', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 2, a: 1 };
    const diff = generateDiff(obj1, obj2);
    assert.strictEqual(diff, '', 'Property order should not matter for objects');
  });

  test('should detect a changed primitive value in a nested object', () => {
    const received = { user: { id: 1, name: 'John Doe' } };
    const expected = { user: { id: 1, name: 'Jane Doe' } };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- Snapshot')), 'Diff should include snapshot header');
    assert.ok(diff.includes(chalk.green('+ Received')), 'Diff should include received header');
    assert.ok(diff.includes(chalk.red('- "Jane Doe"')), 'Diff should show the deleted value');
    assert.ok(diff.includes(chalk.green('+ "John Doe"')), 'Diff should show the added value');
    assert.ok(diff.includes('"name":'), 'Diff should include the key of the changed property');
  });

  test('should detect an added property in an object', () => {
    const received = { a: 1, b: 2, c: 3 };
    const expected = { a: 1, b: 2 };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.green('+ 3')), 'Diff should show the added value');
    assert.ok(diff.includes(chalk.green('"c": ')), 'Diff should show the added key');
    assert.ok(!diff.includes(chalk.red('-')), 'Diff should not contain deletions for this case');
  });

  test('should detect a removed property from an object', () => {
    const received = { a: 1 };
    const expected = { a: 1, b: 2 };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- 2')), 'Diff should show the removed value');
    assert.ok(diff.includes('"b":'), 'Diff should show the key of the removed property');
    assert.ok(!diff.includes(chalk.green('+')), 'Diff should not contain additions for this case');
  });

  test('should detect a changed value in an array', () => {
    const received = [1, 'b', 3];
    const expected = [1, 'a', 3];
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- "a"')), 'Diff should show the deleted array element');
    assert.ok(diff.includes(chalk.green('+ "b"')), 'Diff should show the added array element');
    assert.ok(diff.includes('1,'), 'Diff should show unchanged elements');
    assert.ok(diff.includes('3'), 'Diff should show unchanged elements');
  });

  test('should treat arrays with different lengths as a wholesale change', () => {
    const received = [1, 2, 3, 4];
    const expected = [1, 2, 3];
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red(`- ${JSON.stringify(expected)}`)), 'Diff should show the entire old array as deleted');
    assert.ok(diff.includes(chalk.green(`+ ${JSON.stringify(received)}`)), 'Diff should show the entire new array as added');
  });

  test('should correctly diff objects with null and undefined values', () => {
    const received = { a: 1, b: null };
    const expected = { a: 1, b: 'not null' };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- "not null"')), 'Diff should show deletion of string');
    assert.ok(diff.includes(chalk.green('+ null')), 'Diff should show addition of null');
  });

  test('should correctly diff a change from undefined to a value', () => {
    const received = { a: 1, b: 'defined' };
    const expected = { a: 1, b: undefined };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- undefined')), 'Diff should show deletion of undefined');
    assert.ok(diff.includes(chalk.green('+ "defined"')), 'Diff should show addition of a value');
  });

  test('should correctly diff a change from a value to undefined', () => {
    const received = { a: 1, b: undefined };
    const expected = { a: 1, b: 'was defined' };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- "was defined"')), 'Diff should show deletion of a value');
    assert.ok(diff.includes(chalk.green('+ undefined')), 'Diff should show addition of undefined');
  });

  test('should handle complex nested structures with multiple changes', () => {
    const received = {
      id: 123,
      user: { name: 'Alice', roles: ['admin', 'editor'] },
      posts: [{ id: 1, title: 'New Post' }, { id: 2, comments: [] }],
      active: false,
    };
    const expected = {
      id: 123,
      user: { name: 'Bob', roles: ['editor'] },
      posts: [{ id: 1, title: 'Old Post' }],
      active: true,
    };
    const diff = generateDiff(received, expected);

    // Check user name change
    assert.ok(diff.includes(chalk.red('- "Bob"')));
    assert.ok(diff.includes(chalk.green('+ "Alice"')));

    // Check roles change (detected as whole array change)
    assert.ok(diff.includes(chalk.red(`- ${JSON.stringify(['editor'])}`)));
    assert.ok(diff.includes(chalk.green(`+ ${JSON.stringify(['admin', 'editor'])}`)));

    // Check posts change (detected as whole array change due to length difference)
    assert.ok(diff.includes(chalk.red(`- ${JSON.stringify([{ id: 1, title: 'Old Post' }])}`)));
    assert.ok(diff.includes(chalk.green(`+ ${JSON.stringify(received.posts)}`)));

    // Check active status change
    assert.ok(diff.includes(chalk.red('- true')));
    assert.ok(diff.includes(chalk.green('+ false')));
  });

  test('should handle empty objects and arrays correctly', () => {
    const diff1 = generateDiff({ a: {} }, { a: { b: 1 } });
    assert.ok(diff1.includes(chalk.red('- 1')), 'Should show removal of property b');

    const diff2 = generateDiff({ a: [] }, { a: [1, 2] });
    assert.ok(diff2.includes(chalk.red(`- [1,2]`)), 'Should show removal of array content');
    assert.ok(diff2.includes(chalk.green(`+ []`)), 'Should show addition of empty array');

    const diff3 = generateDiff({}, {});
    assert.strictEqual(diff3, '', 'Should find no diff for two empty objects');

    const diff4 = generateDiff([], []);
    assert.strictEqual(diff4, '', 'Should find no diff for two empty arrays');
  });

  test('should handle type changes at the same key', () => {
    const received = { data: { value: [1, 2] } };
    const expected = { data: { value: 'string' } };
    const diff = generateDiff(received, expected);

    assert.ok(diff.includes(chalk.red('- "string"')), 'Should show string as deleted');
    assert.ok(diff.includes(chalk.green('+ [1,2]')), 'Should show array as added');
  });
});