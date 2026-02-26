/**
 * @file tests/parsers.test.js
 * @description Unit tests for the INI and .env parsers.
 *
 * This test suite covers the functionality of `ini-parser.js` and `env-parser.js`.
 * It verifies that both parsers can correctly read, parse, stringify, and write
 * file content, including handling various edge cases like empty files, comments,
 * special characters, and different quoting styles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { parseIniFile, stringifyIniFile } from '../src/parsers/ini-parser.js';
import { parseEnvFile, stringifyEnvFile } from '../src/parsers/env-parser.js';

// Mock the file system to isolate tests from actual disk I/O
vi.mock('node:fs/promises', async (importOriginal) => {
  const originalModule = await importOriginal();
  return {
    ...originalModule,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

// Helper to resolve paths to a temporary test directory
const TEST_DIR = '/tmp/ini-env-sync-tests';
const getTestPath = (filename) => resolve(TEST_DIR, filename);

describe('INI Parser', () => {
  const mockReadFile = fs.readFile;
  const mockWriteFile = fs.writeFile;

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    vi.resetAllMocks();
  });

  describe('parseIniFile', () => {
    it('should parse a standard INI file with sections', async () => {
      const filePath = getTestPath('standard.ini');
      const content = `
        ; global setting
        globalKey=globalValue
        
        [database]
        host=localhost
        user=testuser
        
        [server]
        port = 8080
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseIniFile(filePath);

      expect(result).toEqual({
        globalKey: 'globalValue',
        database: {
          host: 'localhost',
          user: 'testuser',
        },
        server: {
          port: '8080',
        },
      });
      expect(mockReadFile).toHaveBeenCalledWith(filePath, { encoding: 'utf-8' });
    });

    it('should return an empty object for an empty INI file', async () => {
      const filePath = getTestPath('empty.ini');
      mockReadFile.mockResolvedValue('');

      const result = await parseIniFile(filePath);

      expect(result).toEqual({});
    });

    it('should return an empty object for an INI file with only comments and whitespace', async () => {
      const filePath = getTestPath('comments.ini');
      const content = `
        ; This is a file with only comments
        # Another comment style
        
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseIniFile(filePath);

      expect(result).toEqual({});
    });

    it('should throw a TypeError for an invalid file path', async () => {
      await expect(parseIniFile(null)).rejects.toThrow(TypeError);
      await expect(parseIniFile(123)).rejects.toThrow('A valid file path must be provided as a string.');
    });

    it('should throw a contextual error if the file cannot be read', async () => {
      const filePath = getTestPath('nonexistent.ini');
      const readError = new Error('File not found');
      mockReadFile.mockRejectedValue(readError);

      await expect(parseIniFile(filePath)).rejects.toThrow(
        `Failed to read INI file at "${filePath}": ${readError.message}`
      );
    });

    it('should throw a contextual error for invalid INI syntax', async () => {
      const filePath = getTestPath('invalid.ini');
      const content = 'this is not valid ini content';
      mockReadFile.mockResolvedValue(content);

      // The 'ini' library throws a specific error message we can check for
      await expect(parseIniFile(filePath)).rejects.toThrow(
        /Failed to parse INI content from ".*": Expected .*/
      );
    });
  });

  describe('stringifyIniFile', () => {
    it('should stringify a standard object to INI format', async () => {
      const filePath = getTestPath('output.ini');
      const data = {
        globalKey: 'globalValue',
        database: {
          host: 'localhost',
          user: 'testuser',
        },
      };
      const expectedContent = `globalKey = globalValue
[database]
host = localhost
user = testuser
`;

      await stringifyIniFile(filePath, data);

      expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should handle an empty object by creating an empty file', async () => {
      const filePath = getTestPath('empty_output.ini');
      const data = {};
      
      await stringifyIniFile(filePath, data);

      expect(mockWriteFile).toHaveBeenCalledWith(filePath, '', { encoding: 'utf-8' });
    });

    it('should respect the whitespace option', async () => {
        const filePath = getTestPath('no_whitespace.ini');
        const data = { key: 'value' };
        const expectedContent = `key=value\n`;

        await stringifyIniFile(filePath, data, { whitespace: false });

        expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should throw a TypeError for invalid input data', async () => {
      const filePath = getTestPath('test.ini');
      await expect(stringifyIniFile(filePath, null)).rejects.toThrow(TypeError);
      await expect(stringifyIniFile(filePath, 'a string')).rejects.toThrow('Data to be stringified must be a non-null object.');
      await expect(stringifyIniFile(filePath, [])).rejects.toThrow('Data to be stringified must be a non-null object.');
    });

    it('should throw a contextual error if the file cannot be written', async () => {
      const filePath = getTestPath('unwritable.ini');
      const writeError = new Error('Permission denied');
      mockWriteFile.mockRejectedValue(writeError);

      await expect(stringifyIniFile(filePath, { a: 1 })).rejects.toThrow(
        `Failed to write INI file to "${filePath}": ${writeError.message}`
      );
    });
  });
});

describe('ENV Parser', () => {
  const mockReadFile = fs.readFile;
  const mockWriteFile = fs.writeFile;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseEnvFile', () => {
    it('should parse a standard .env file', async () => {
      const filePath = getTestPath('standard.env');
      const content = `
        # This is a comment
        DB_HOST=localhost
        DB_PORT=5432
        
        API_KEY=some_secret_key
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        API_KEY: 'some_secret_key',
      });
      expect(mockReadFile).toHaveBeenCalledWith(filePath, { encoding: 'utf-8' });
    });

    it('should handle various quoting styles and strip quotes', async () => {
      const filePath = getTestPath('quotes.env');
      const content = `
        SINGLE_QUOTED='hello world'
        DOUBLE_QUOTED="hello universe"
        BACKTICK_QUOTED=\`hello galaxy\`
        UNQUOTED=hello_planet
        EMPTY_QUOTED=""
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({
        SINGLE_QUOTED: 'hello world',
        DOUBLE_QUOTED: 'hello universe',
        BACKTICK_QUOTED: 'hello galaxy',
        UNQUOTED: 'hello_planet',
        EMPTY_QUOTED: '',
      });
    });

    it('should handle values with special characters when quoted', async () => {
      const filePath = getTestPath('special.env');
      const content = `
        SPECIAL_CHARS="a=b#c"
        SPACES="  leading and trailing spaces  "
        JSON_VAL='{"key": "value"}'
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({
        SPECIAL_CHARS: 'a=b#c',
        SPACES: '  leading and trailing spaces  ',
        JSON_VAL: '{"key": "value"}',
      });
    });

    it('should handle keys with dots and hyphens', async () => {
      const filePath = getTestPath('key-styles.env');
      const content = `
        app.version=1.0.0
        api-key=secret
      `;
      mockReadFile.mockResolvedValue(content);

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({
        'app.version': '1.0.0',
        'api-key': 'secret',
      });
    });

    it('should return an empty object for an empty file', async () => {
      const filePath = getTestPath('empty.env');
      mockReadFile.mockResolvedValue('');

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({});
    });

    it('should return an empty object if the file does not exist (ENOENT)', async () => {
      const filePath = getTestPath('nonexistent.env');
      const readError = new Error('File not found');
      readError.code = 'ENOENT';
      mockReadFile.mockRejectedValue(readError);

      const result = await parseEnvFile(filePath);

      expect(result).toEqual({});
    });

    it('should re-throw other file read errors', async () => {
      const filePath = getTestPath('unreadable.env');
      const readError = new Error('Permission denied');
      readError.code = 'EACCES';
      mockReadFile.mockRejectedValue(readError);

      await expect(parseEnvFile(filePath)).rejects.toThrow(
        `Failed to read .env file at "${filePath}": ${readError.message}`
      );
    });

    it('should ignore malformed lines', async () => {
        const filePath = getTestPath('malformed.env');
        const content = `
          GOOD_KEY=good_value
          just a string
          =no_key
          KEY_ONLY=
        `;
        mockReadFile.mockResolvedValue(content);
  
        const result = await parseEnvFile(filePath);
  
        expect(result).toEqual({
          GOOD_KEY: 'good_value',
          KEY_ONLY: ''
        });
      });
  });

  describe('stringifyEnvFile', () => {
    it('should stringify a standard object to .env format', async () => {
      const filePath = getTestPath('output.env');
      const data = {
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        ENABLED: true,
      };
      const expectedContent = `DB_HOST=localhost\nDB_PORT=5432\nENABLED=true\n`;

      await stringifyEnvFile(filePath, data);

      expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should add quotes for values that need them', async () => {
      const filePath = getTestPath('quotes_output.env');
      const data = {
        EMPTY: '',
        SPACES: ' value with spaces ',
        SPECIAL: 'value#with#comment',
        EQUALS: 'key=value',
      };
      const expectedContent = `EMPTY=""\nSPACES=" value with spaces "\nSPECIAL="value#with#comment"\nEQUALS="key=value"\n`;

      await stringifyEnvFile(filePath, data);

      expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should escape double quotes within a value before quoting', async () => {
        const filePath = getTestPath('escape.env');
        const data = {
            JSON_STRING: '{"message":"hello \"world\""}'
        };
        const expectedContent = 'JSON_STRING="{\\"message\\":\\"hello \\\\\\"world\\\\\\"\"}"\n';

        await stringifyEnvFile(filePath, data);

        expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should handle null and undefined values as empty strings', async () => {
        const filePath = getTestPath('nulls.env');
        const data = {
            NULL_VAL: null,
            UNDEFINED_VAL: undefined
        };
        // Empty strings need quotes
        const expectedContent = `NULL_VAL=""\nUNDEFINED_VAL=""\n`;

        await stringifyEnvFile(filePath, data);

        expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
    });

    it('should skip keys with invalid characters and log a warning', async () => {
        const filePath = getTestPath('invalid_keys.env');
        const data = {
            'invalid key': 'value1',
            'VALID_KEY': 'value2',
            'another-valid.key': 'value3'
        };
        const expectedContent = `VALID_KEY=value2\nanother-valid.key=value3\n`;
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await stringifyEnvFile(filePath, data);

        expect(mockWriteFile).toHaveBeenCalledWith(filePath, expectedContent, { encoding: 'utf-8' });
        expect(consoleWarnSpy).toHaveBeenCalledWith('Skipping invalid key for .env format: "invalid key"');
        
        consoleWarnSpy.mockRestore();
    });

    it('should throw a contextual error if the file cannot be written', async () => {
      const filePath = getTestPath('unwritable.env');
      const writeError = new Error('Permission denied');
      mockWriteFile.mockRejectedValue(writeError);

      await expect(stringifyEnvFile(filePath, { a: 1 })).rejects.toThrow(
        `Failed to write .env file to "${filePath}": ${writeError.message}`
      );
    });

    it('should throw a TypeError for invalid input data', async () => {
        const filePath = getTestPath('test.env');
        await expect(stringifyEnvFile(filePath, null)).rejects.toThrow(TypeError);
        await expect(stringifyEnvFile(filePath, 'a string')).rejects.toThrow('Data to be stringified must be a non-null object.');
      });
  });
});