/**
 * @file test/comment-extractor.test.js
 * @description Unit tests for the comment extractor functionality.
 * This file tests the `extractSchedulesFromFileContent` function to ensure it correctly
 * parses various comment styles, handles valid and invalid cron expressions, and manages
 * different file content scenarios.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve } from 'node:path';
import { extractSchedulesFromFileContent } from '../src/parsers/comment-extractor.js';

const MOCK_FILE_PATH = resolve('/mock/project/src/task.js');

describe('extractSchedulesFromFileContent', () => {

  it('should extract a valid cron schedule from a JavaScript file with // comment', () => {
    const fileContent = `
      // Some leading comments
      // @cron: 0 5 * * * /usr/bin/node /app/task.js --action=daily-cleanup
      // Some trailing comments
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 1, 'Should find exactly one schedule');
    const [schedule] = schedules;
    assert.deepStrictEqual(schedule, {
      schedule: '0 5 * * *',
      command: '/usr/bin/node /app/task.js --action=daily-cleanup',
      sourceFile: MOCK_FILE_PATH,
      sourceLine: 3,
    });
  });

  it('should extract a valid cron schedule from a Python file with # comment', () => {
    const fileContent = `
# A Python script for data processing
# @cron: */15 9-17 * * 1-5 /usr/bin/python3 /app/reporter.py
import sys
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, '/mock/project/reporter.py');

    assert.strictEqual(schedules.length, 1);
    assert.deepStrictEqual(schedules[0], {
      schedule: '*/15 9-17 * * 1-5',
      command: '/usr/bin/python3 /app/reporter.py',
      sourceFile: resolve('/mock/project/reporter.py'),
      sourceLine: 3,
    });
  });

  it('should extract a valid cron schedule from a SQL file with -- comment', () => {
    const fileContent = `-- Database maintenance script
-- @cron: 0 3 * * 0 psql -f /app/scripts/vacuum.sql
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, '/mock/project/scripts/vacuum.sql');

    assert.strictEqual(schedules.length, 1);
    assert.deepStrictEqual(schedules[0], {
      schedule: '0 3 * * 0',
      command: 'psql -f /app/scripts/vacuum.sql',
      sourceFile: resolve('/mock/project/scripts/vacuum.sql'),
      sourceLine: 2,
    });
  });

  it('should extract a valid cron schedule from a CSS-like file with /* */ comment', () => {
    const fileContent = `
      /*
       * @cron: 0 0 1 * * /app/monthly-billing
       */
      body { color: #333; }
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 1);
    assert.deepStrictEqual(schedules[0], {
      schedule: '0 0 1 * *',
      command: '/app/monthly-billing',
      sourceFile: MOCK_FILE_PATH,
      sourceLine: 3,
    });
  });
  
  it('should extract a valid cron schedule from an HTML-like file with <!-- --> comment', () => {
    const fileContent = `
      <!--
        @cron: 0 12 * * * curl https://example.com/api/health-check
      -->
      <h1>Hello</h1>
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, '/mock/project/index.html');

    assert.strictEqual(schedules.length, 1);
    assert.deepStrictEqual(schedules[0], {
      schedule: '0 12 * * *',
      command: 'curl https://example.com/api/health-check',
      sourceFile: resolve('/mock/project/index.html'),
      sourceLine: 3,
    });
  });

  it('should extract multiple schedules from a single file', () => {
    const fileContent = `
      // @cron: 0 5 * * * /usr/bin/node /app/task.js --source=api
      const task1 = 'api';

      # @cron: 30 5 * * * /usr/bin/node /app/task.js --source=db
      const task2 = 'db';
      
      /* @cron: 0 0 * * * /app/backup.sh */
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 3, 'Should find three schedules');
    assert.deepStrictEqual(schedules[0], {
      schedule: '0 5 * * *',
      command: '/usr/bin/node /app/task.js --source=api',
      sourceFile: MOCK_FILE_PATH,
      sourceLine: 2,
    });
    assert.deepStrictEqual(schedules[1], {
      schedule: '30 5 * * *',
      command: '/usr/bin/node /app/task.js --source=db',
      sourceFile: MOCK_FILE_PATH,
      sourceLine: 5,
    });
    assert.deepStrictEqual(schedules[2], {
      schedule: '0 0 * * *',
      command: '/app/backup.sh',
      sourceFile: MOCK_FILE_PATH,
      sourceLine: 8,
    });
  });

  it('should correctly handle various whitespace arrangements', () => {
    const fileContent = `
        //   @cron:   0 1 * * *    /app/task --foo
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 1);
    assert.strictEqual(schedules[0].schedule, '0 1 * * *');
    assert.strictEqual(schedules[0].command, '/app/task --foo');
    assert.strictEqual(schedules[0].sourceLine, 2);
  });

  it('should return an empty array if no cron directives are found', () => {
    const fileContent = `
      // This is a regular comment
      function doWork() {
        console.log('Working...');
      }
      # Another comment without the directive
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);
    assert.strictEqual(schedules.length, 0);
  });

  it('should return an empty array for an empty file', () => {
    const fileContent = '';
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);
    assert.strictEqual(schedules.length, 0);
  });

  it('should ignore lines that look similar but do not match the format', () => {
    const fileContent = `
      // @cron: missing command
      // cron: 0 5 * * * /app/task (missing @)
      // @cron 0 5 * * * /app/task (missing :)
      // not a comment @cron: 0 5 * * * /app/task
    `;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);
    assert.strictEqual(schedules.length, 0);
  });

  it('should throw a ParserError for an invalid cron schedule format (too many parts)', () => {
    const fileContent = '// @cron: 0 5 * * * * /app/task';
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH),
      (err) => {
        assert.strictEqual(err.name, 'ParserError');
        assert.strictEqual(err.message, 'Invalid cron schedule format: "0 5 * * * *"');
        assert.strictEqual(err.filePath, MOCK_FILE_PATH);
        assert.strictEqual(err.lineNumber, 1);
        return true;
      }
    );
  });

  it('should throw a ParserError for an invalid cron schedule format (value out of range)', () => {
    const fileContent = '/* @cron: 60 5 * * * /app/task */';
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH),
      {
        name: 'ParserError',
        message: 'Invalid cron schedule format: "60 5 * * *"',
        filePath: MOCK_FILE_PATH,
        lineNumber: 1,
      }
    );
  });
  
  it('should throw a ParserError for an invalid cron schedule format (not enough parts)', () => {
    const fileContent = '-- @cron: 5 * * * /app/task';
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH),
      {
        name: 'ParserError',
        message: 'Invalid cron schedule format: "5 * * *"',
        filePath: MOCK_FILE_PATH,
        lineNumber: 1,
      }
    );
  });

  it('should correctly handle commands with special characters and complex arguments', () => {
    const command = 'bash -c "echo \'Hello World\' >> /var/log/cron.log && curl -X POST http://localhost:3000/hook"';
    const fileContent = `// @cron: 0 12 * * * ${command}`;
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 1);
    assert.strictEqual(schedules[0].command, command);
  });

  it('should handle Windows-style line endings (CRLF)', () => {
    const fileContent = '// @cron: 0 1 * * *\t/app/task1\r\n// @cron: 0 2 * * *\t/app/task2\r\n';
    const schedules = extractSchedulesFromFileContent(fileContent, MOCK_FILE_PATH);

    assert.strictEqual(schedules.length, 2);
    assert.strictEqual(schedules[0].sourceLine, 1);
    assert.strictEqual(schedules[0].command, '/app/task1');
    assert.strictEqual(schedules[1].sourceLine, 2);
    assert.strictEqual(schedules[1].command, '/app/task2');
  });

  it('should throw a TypeError if fileContent is not a string', () => {
    assert.throws(
      () => extractSchedulesFromFileContent(null, MOCK_FILE_PATH),
      {
        name: 'TypeError',
        message: 'fileContent must be a string.',
      }
    );
    assert.throws(
      () => extractSchedulesFromFileContent(undefined, MOCK_FILE_PATH),
      {
        name: 'TypeError',
        message: 'fileContent must be a string.',
      }
    );
    assert.throws(
      () => extractSchedulesFromFileContent(123, MOCK_FILE_PATH),
      {
        name: 'TypeError',
        message: 'fileContent must be a string.',
      }
    );
  });

  it('should throw a TypeError if filePath is not a non-empty string', () => {
    const fileContent = '// @cron: 0 0 * * * /app/task';
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, null),
      {
        name: 'TypeError',
        message: 'filePath must be a non-empty string.',
      }
    );
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, ''),
      {
        name: 'TypeError',
        message: 'filePath must be a non-empty string.',
      }
    );
    assert.throws(
      () => extractSchedulesFromFileContent(fileContent, 123),
      {
        name: 'TypeError',
        message: 'filePath must be a non-empty string.',
      }
    );
  });
});