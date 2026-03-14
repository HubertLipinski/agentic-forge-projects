import chalk from 'chalk';

/**
 * @fileoverview A utility to generate a colorized, human-readable string diff
 * between two JavaScript objects. This is a simplified, purpose-built diffing
 * algorithm for snapshot testing, not a generic, full-featured diff library.
 * It focuses on highlighting additions and deletions in a way that is easy
 * to read in a terminal.
 */

const DELETED_MARKER = Symbol('DELETED_MARKER');
const ADDED_MARKER = Symbol('ADDED_MARKER');

/**
 * Compares two values (primitives, objects, or arrays) recursively and returns
 * a new object representing the differences.
 *
 * @param {*} received The value received from the current test run.
 * @param {*} expected The value from the existing snapshot.
 * @returns {*} A new object/array highlighting the differences, or a primitive
 *              if no differences are found at that level.
 */
function compare(received, expected) {
  // If values are strictly equal, no diff.
  if (Object.is(received, expected)) {
    return expected;
  }

  // If one is null/undefined and the other is not.
  if (received == null || expected == null) {
    return {
      [DELETED_MARKER]: expected,
      [ADDED_MARKER]: received,
    };
  }

  // Both are arrays, compare elements.
  if (Array.isArray(received) && Array.isArray(expected)) {
    // A simple length check is a clear difference.
    if (received.length !== expected.length) {
      return {
        [DELETED_MARKER]: expected,
        [ADDED_MARKER]: received,
      };
    }
    const result = [];
    let hasDifference = false;
    for (let i = 0; i < expected.length; i++) {
      const diff = compare(received[i], expected[i]);
      if (diff !== expected[i]) {
        hasDifference = true;
      }
      result.push(diff);
    }
    return hasDifference ? result : expected;
  }

  // Both are objects, compare properties.
  if (typeof received === 'object' && typeof expected === 'object') {
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(received)]);
    const result = {};
    let hasDifference = false;

    for (const key of allKeys) {
      const receivedHasKey = Object.prototype.hasOwnProperty.call(received, key);
      const expectedHasKey = Object.prototype.hasOwnProperty.call(expected, key);

      if (receivedHasKey && expectedHasKey) {
        const diff = compare(received[key], expected[key]);
        if (diff !== expected[key]) {
          hasDifference = true;
        }
        result[key] = diff;
      } else if (expectedHasKey) {
        result[key] = { [DELETED_MARKER]: expected[key] };
        hasDifference = true;
      } else { // receivedHasKey
        result[key] = { [ADDED_MARKER]: received[key] };
        hasDifference = true;
      }
    }
    return hasDifference ? result : expected;
  }

  // Primitives are different.
  return {
    [DELETED_MARKER]: expected,
    [ADDED_MARKER]: received,
  };
}

/**
 * Formats the diff object from `compare` into a colorized string.
 *
 * @param {*} diff The diff object.
 * @param {number} [indent=0] The current indentation level for pretty-printing.
 * @returns {string} The formatted, colorized string representation of the diff.
 */
function format(diff, indent = 0) {
  const indentStr = ' '.repeat(indent);

  if (diff && typeof diff === 'object') {
    if (DELETED_MARKER in diff && ADDED_MARKER in diff) {
      const deletedStr = JSON.stringify(diff[DELETED_MARKER]);
      const addedStr = JSON.stringify(diff[ADDED_MARKER]);
      return `${chalk.red(`- ${deletedStr}`)}\n${indentStr}${chalk.green(`+ ${addedStr}`)}`;
    }
    if (DELETED_MARKER in diff) {
      return chalk.red(`- ${JSON.stringify(diff[DELETED_MARKER])}`);
    }
    if (ADDED_MARKER in diff) {
      return chalk.green(`+ ${JSON.stringify(diff[ADDED_MARKER])}`);
    }

    if (Array.isArray(diff)) {
      if (diff.length === 0) return '[]';
      const lines = diff.map(item => `${' '.repeat(indent + 2)}${format(item, indent + 2)}`);
      return `[\n${lines.join(',\n')}\n${indentStr}]`;
    }

    const keys = Object.keys(diff);
    if (keys.length === 0) return '{}';
    const lines = keys.map(key => {
      const valueStr = format(diff[key], indent + 2);
      const keyStr = `"${key}": `;
      return `${' '.repeat(indent + 2)}${keyStr}${valueStr}`;
    });
    return `{\n${lines.join(',\n')}\n${indentStr}}`;
  }

  return JSON.stringify(diff);
}


/**
 * Generates a colorized, human-readable string diff between two JavaScript values.
 *
 * @param {*} received The actual value produced by the code.
 * @param {*} expected The expected value from the snapshot.
 * @returns {string} A string representing the diff, with additions in green and
 *                   deletions in red. Returns an empty string if there is no difference.
 */
export function generateDiff(received, expected) {
  const diffResult = compare(received, expected);

  // If the result of compare is the same as the expected object, there's no difference.
  if (diffResult === expected) {
    return '';
  }

  const header =
    `${chalk.red('- Snapshot')} ${chalk.green('+ Received')}\n\n`;

  const formattedDiff = format(diffResult);

  return header + formattedDiff;
}