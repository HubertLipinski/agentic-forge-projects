/**
 * @file test/pipeline.test.js
 * @description Integration tests for the end-to-end CSV transformation pipeline.
 * These tests verify the complete workflow, from reading a source CSV, applying a
 * configuration, and writing the transformed output. They use temporary files
 * to simulate real-world file I/O.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Writable } from 'node:stream';
import { transformCsv } from '../src/index.js';

// --- Test Setup ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp');

// Create a temporary directory for test files before running tests.
before(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create temp directory for tests:', error);
    process.exit(1);
  }
});

// Clean up the temporary directory after all tests have run.
after(async () => {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to clean up temp directory:', error);
  }
});

/**
 * A simple in-memory writable stream to capture output for verification.
 */
class MemoryWriter extends Writable {
  constructor(options) {
    super(options);
    this.chunks = [];
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  getContent() {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

// --- Test Suites ---

describe('End-to-End Pipeline Integration Tests', () => {

  it('should perform a basic mapping and renaming transformation (file to file)', async () => {
    const inputCsv = 'id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com';
    const config = {
      mapping: [
        { from: 'id', to: 'user_id' },
        { from: 'name', to: 'full_name' },
        { from: 'email' },
      ],
    };

    const inputPath = path.join(TEMP_DIR, 'basic-input.csv');
    const outputPath = path.join(TEMP_DIR, 'basic-output.csv');
    await fs.writeFile(inputPath, inputCsv);

    await transformCsv({
      source: inputPath,
      destination: outputPath,
      config,
    });

    const result = await fs.readFile(outputPath, 'utf-8');
    const expected = 'user_id,full_name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com\n';

    assert.strictEqual(result, expected);
  });

  it('should filter rows based on a simple "equals" condition', async () => {
    const inputCsv = 'id,status,value\n1,active,100\n2,inactive,200\n3,active,300';
    const config = {
      filter: [{ column: 'status', equals: 'active' }],
      mapping: [{ from: 'id' }, { from: 'value' }],
    };

    const inputPath = path.join(TEMP_DIR, 'filter-input.csv');
    const outputPath = path.join(TEMP_DIR, 'filter-output.csv');
    await fs.writeFile(inputPath, inputCsv);

    await transformCsv({
      source: inputPath,
      destination: outputPath,
      config,
    });

    const result = await fs.readFile(outputPath, 'utf-8');
    const expected = 'id,value\n1,100\n3,300\n';

    assert.strictEqual(result, expected);
  });

  it('should apply a chain of value transformations', async () => {
    const inputCsv = 'name,balance\n  john doe  , $1,234.56 \n  JANE SMITH  , $987.1 ';
    const config = {
      mapping: [
        {
          from: 'name',
          to: 'formattedName',
          transform: [
            { name: 'trim' },
            { name: 'toUpperCase' },
          ],
        },
        {
          from: 'balance',
          to: 'numericBalance',
          transform: [
            { name: 'trim' },
            { name: 'replace', params: ['$', ''] },
            { name: 'replace', params: [',', ''] },
            { name: 'parseFloat' },
            { name: 'toFixed', params: [2] },
          ],
        },
      ],
    };

    const inputPath = path.join(TEMP_DIR, 'transform-input.csv');
    const outputPath = path.join(TEMP_DIR, 'transform-output.csv');
    await fs.writeFile(inputPath, inputCsv);

    await transformCsv({
      source: inputPath,
      destination: outputPath,
      config,
    });

    const result = await fs.readFile(outputPath, 'utf-8');
    const expected = 'formattedName,numericBalance\nJOHN DOE,1234.56\nJANE SMITH,987.10\n';

    assert.strictEqual(result, expected);
  });

  it('should work with streams instead of file paths', async () => {
    const sourceData = 'id,name\n1,stream_user';
    const sourceStream = Readable.from(sourceData);
    const destinationStream = new MemoryWriter();

    const config = {
      mapping: [{ from: 'id', to: 'userId' }, { from: 'name' }],
    };

    await transformCsv({
      source: sourceStream,
      destination: destinationStream,
      config,
    });

    const result = destinationStream.getContent();
    const expected = 'userId,name\n1,stream_user\n';

    assert.strictEqual(result, expected);
  });

  it('should use custom transformers when provided programmatically', async () => {
    const sourceStream = Readable.from('id,value\n1,10\n2,20');
    const destinationStream = new MemoryWriter();

    const config = {
      mapping: [
        { from: 'id' },
        { from: 'value', transform: [{ name: 'multiply', params: [3] }] },
      ],
    };

    const customTransformers = {
      multiply: (value, factor) => Number(value) * factor,
    };

    await transformCsv({
      source: sourceStream,
      destination: destinationStream,
      config,
      customTransformers,
    });

    const result = destinationStream.getContent();
    const expected = 'id,value\n1,30\n2,60\n';

    assert.strictEqual(result, expected);
  });

  it('should handle different CSV delimiters for input and output', async () => {
    const inputCsv = 'id;name;value\n1;Semicolon;100\n2;Test;200';
    const config = {
      csvParseOptions: { delimiter: ';' },
      csvStringifyOptions: { delimiter: '\t' },
      mapping: [{ from: 'id' }, { from: 'name' }, { from: 'value' }],
    };

    const sourceStream = Readable.from(inputCsv);
    const destinationStream = new MemoryWriter();

    await transformCsv({
      source: sourceStream,
      destination: destinationStream,
      config,
    });

    const result = destinationStream.getContent();
    const expected = 'id\tname\tvalue\n1\tSemicolon\t100\n2\tTest\t200\n';

    assert.strictEqual(result, expected);
  });

  it('should reject with a CsvTransformError for an invalid source file path', async () => {
    const invalidPath = path.join(TEMP_DIR, 'non-existent-input.csv');
    const outputPath = path.join(TEMP_DIR, 'error-output.csv');

    await assert.rejects(
      transformCsv({
        source: invalidPath,
        destination: outputPath,
        config: { mapping: [{ from: 'a' }] },
      }),
      (err) => {
        assert.strictEqual(err.name, 'CsvTransformError');
        assert.match(err.message, /CSV transformation failed/);
        assert.match(err.cause.message, /no such file or directory/);
        return true;
      }
    );
  });

  it('should reject with a CsvTransformError for an invalid config file path', async () => {
    const inputCsv = 'a,b\n1,2';
    const inputPath = path.join(TEMP_DIR, 'valid-input.csv');
    await fs.writeFile(inputPath, inputCsv);

    const invalidConfigPath = path.join(TEMP_DIR, 'non-existent-config.json');

    await assert.rejects(
      transformCsv({
        source: inputPath,
        destination: path.join(TEMP_DIR, 'error-output.csv'),
        config: invalidConfigPath,
      }),
      (err) => {
        assert.strictEqual(err.name, 'CsvTransformError');
        assert.strictEqual(err.cause.name, 'ConfigError');
        assert.match(err.cause.message, /Configuration file not found/);
        return true;
      }
    );
  });

  it('should reject with a CsvTransformError for a malformed config object', async () => {
    await assert.rejects(
      transformCsv({
        source: Readable.from('a,b\n1,2'),
        destination: new MemoryWriter(),
        config: { not_mapping: [] }, // Missing 'mapping' property
      }),
      {
        name: 'CsvTransformError',
        message: 'CSV transformation failed: The provided config object must have a `mapping` property.',
      }
    );
  });

  it('should correctly process a complex transformation from the examples', async () => {
    // This test uses the same files as `examples/run-example.js` to ensure consistency.
    const configFilePath = path.resolve(__dirname, '../examples/config/complex-transform.json');
    const outputPath = path.join(TEMP_DIR, 'complex-output.tsv');

    const inputCsvContent =
      'user_id,first_name,last_name,email_address,balance,status,is_deleted,registration_date,notes\n' +
      '1,  John  ,  Doe  ,JOHN.DOE@example.com,$150.50,active,false,2023-01-10,\n' +
      '2,Jane,Smith,jane.smith@example.com,$200,active,false,2023-02-15,Has an open ticket\n' +
      '3,Inactive,User,inactive@example.com,$0,inactive,false,2022-05-20,\n' +
      '4,Deleted,Account,deleted@example.com,$50,active,true,2021-11-11,To be removed\n' +
      '5,Peter,Jones,peter.jones@example.com,$99.99,active,false,2023-03-01,\n';

    const sourceStream = Readable.from(inputCsvContent);

    await transformCsv({
      source: sourceStream,
      destination: outputPath,
      config: configFilePath,
    });

    const result = await fs.readFile(outputPath, 'utf-8');

    // The config filters for `status: "active"` and `is_deleted: not "true"`.
    // It also skips line 1 (header) and applies various transformations.
    // The output delimiter is a tab.
    const expectedLines = [
      'id\tfirstName\tlastName\temail\taccountBalance\tnotes\tregisteredOn',
      'user-1\tJOHN\tDOE\tjohn.doe@example.com\t150.50\tNO_NOTES_PROVIDED\t2023-01-10',
      'user-2\tJANE\tSMITH\tjane.smith@example.com\t200.00\tHas an open ticket\t2023-02-15',
      'user-5\tPETER\tJONES\tpeter.jones@example.com\t99.99\tNO_NOTES_PROVIDED\t2023-03-01',
      '' // Trailing newline
    ];
    const expected = expectedLines.join('\n');

    assert.strictEqual(result, expected);
  });
});