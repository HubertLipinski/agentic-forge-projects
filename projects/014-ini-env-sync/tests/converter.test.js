/**
 * @file tests/converter.test.js
 * @description Unit tests for the core conversion logic between INI and .env data structures.
 *
 * This test suite validates the `convertIniToEnv` and `convertEnvToIni` functions
 * from `src/core/converter.js`. It ensures that key flattening, prefixing,
 * case transformations, and the reverse process of reconstructing sections
 * work as expected under various conditions and with different options.
 */

import { describe, it, expect } from 'vitest';
import { convertIniToEnv, convertEnvToIni } from '../src/core/converter.js';

describe('Converter Logic', () => {
  describe('convertIniToEnv', () => {
    const sampleIniData = {
      topLevelKey: 'topValue',
      'another-key': true,
      database: {
        host: 'localhost',
        port: 5432,
        user: 'test_user',
      },
      'API-Settings': {
        apiKey: 'secret123',
        'timeout-ms': 30000,
      },
    };

    it('should convert a standard INI structure to .env with default options (SNAKE_CASE)', () => {
      const result = convertIniToEnv(sampleIniData);
      expect(result).toEqual({
        TOP_LEVEL_KEY: 'topValue',
        'ANOTHER-KEY': 'true',
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USER: 'test_user',
        API_SETTINGS_API_KEY: 'secret123',
        'API_SETTINGS_TIMEOUT-MS': '30000',
      });
    });

    it('should handle an empty INI object', () => {
      const result = convertIniToEnv({});
      expect(result).toEqual({});
    });

    it('should handle an INI object with only top-level keys', () => {
      const iniData = {
        keyOne: 'value1',
        keyTwo: 'value2',
      };
      const result = convertIniToEnv(iniData);
      expect(result).toEqual({
        KEY_ONE: 'value1',
        KEY_TWO: 'value2',
      });
    });

    it('should handle an INI object with only sections', () => {
      const iniData = {
        database: { host: 'db', port: '5432' },
        server: { host: 'app', port: '80' },
      };
      const result = convertIniToEnv(iniData);
      expect(result).toEqual({
        DATABASE_HOST: 'db',
        DATABASE_PORT: '5432',
        SERVER_HOST: 'app',
        SERVER_PORT: '80',
      });
    });

    it('should correctly handle null and undefined values by converting them to empty strings', () => {
      const iniData = {
        key1: null,
        section: {
          key2: undefined,
        },
      };
      const result = convertIniToEnv(iniData);
      expect(result).toEqual({
        KEY1: '',
        SECTION_KEY2: '',
      });
    });

    it('should use a custom prefix delimiter when provided', () => {
      const options = { prefixDelimiter: '__' };
      const result = convertIniToEnv(sampleIniData, options);
      expect(result).toEqual({
        TOP_LEVEL_KEY: 'topValue',
        'ANOTHER-KEY': 'true',
        DATABASE__HOST: 'localhost',
        DATABASE__PORT: '5432',
        DATABASE__USER: 'test_user',
        API_SETTINGS__API_KEY: 'secret123',
        'API_SETTINGS__TIMEOUT-MS': '30000',
      });
    });

    it('should apply a different case transformation (UPPERCASE)', () => {
      const options = { caseType: 'UPPERCASE' };
      const result = convertIniToEnv(sampleIniData, options);
      expect(result).toEqual({
        'TOPLEVELKEY': 'topValue',
        'ANOTHER-KEY': 'true',
        'DATABASE_HOST': 'localhost',
        'DATABASE_PORT': '5432',
        'DATABASE_USER': 'test_user',
        'API-SETTINGS_APIKEY': 'secret123',
        'API-SETTINGS_TIMEOUT-MS': '30000',
      });
    });

    it('should apply a different case transformation (LOWERCASE)', () => {
        const options = { caseType: 'LOWERCASE' };
        const result = convertIniToEnv(sampleIniData, options);
        expect(result).toEqual({
          'toplevelkey': 'topValue',
          'another-key': 'true',
          'database_host': 'localhost',
          'database_port': '5432',
          'database_user': 'test_user',
          'api-settings_apikey': 'secret123',
          'api-settings_timeout-ms': '30000',
        });
      });

    it('should throw a TypeError for invalid input data', () => {
      expect(() => convertIniToEnv(null)).toThrow(TypeError);
      expect(() => convertIniToEnv('not an object')).toThrow('Input iniData must be a non-null object.');
      expect(() => convertIniToEnv([])).toThrow('Input iniData must be a non-null object.');
    });

    it('should throw an error for an unsupported case type', () => {
      const options = { caseType: 'INVALID_CASE' };
      expect(() => convertIniToEnv(sampleIniData, options)).toThrow(
        'Unsupported case type: "INVALID_CASE". Supported types are: SNAKE_CASE, UPPERCASE, LOWERCASE.'
      );
    });

    it('should throw a TypeError for invalid options', () => {
        expect(() => convertIniToEnv({}, { caseType: 123 })).toThrow('options.caseType must be a non-empty string.');
        expect(() => convertIniToEnv({}, { prefixDelimiter: false })).toThrow('options.prefixDelimiter must be a string.');
    });
  });

  describe('convertEnvToIni', () => {
    const sampleEnvData = {
      TOP_LEVEL_KEY: 'topValue',
      'ANOTHER-KEY': 'true',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_USER_NAME: 'test_user', // Key with multiple delimiters
      API_SETTINGS_API_KEY: 'secret123',
    };

    it('should convert a standard .env structure to INI with default options', () => {
      const result = convertEnvToIni(sampleEnvData);
      expect(result).toEqual({
        TOP_LEVEL_KEY: 'topValue',
        'ANOTHER-KEY': 'true',
        DATABASE: {
          HOST: 'localhost',
          PORT: '5432',
          USER_NAME: 'test_user',
        },
        API_SETTINGS: {
          API_KEY: 'secret123',
        },
      });
    });

    it('should handle an empty .env object', () => {
      const result = convertEnvToIni({});
      expect(result).toEqual({});
    });

    it('should handle a .env object with only top-level keys (no delimiters)', () => {
      const envData = {
        KEYONE: 'value1',
        KEYTWO: 'value2',
      };
      const result = convertEnvToIni(envData);
      expect(result).toEqual({
        KEYONE: 'value1',
        KEYTWO: 'value2',
      });
    });

    it('should use a custom prefix delimiter to split keys into sections', () => {
      const envData = {
        'database--host': 'db',
        'database--port': '5432',
        'server--host': 'app',
      };
      const options = { prefixDelimiter: '--' };
      const result = convertEnvToIni(envData, options);
      expect(result).toEqual({
        database: {
          host: 'db',
          port: '5432',
        },
        server: {
          host: 'app',
        },
      });
    });

    it('should treat keys with leading or trailing delimiters as top-level', () => {
        const envData = {
            '_LEADING': 'value1',
            'TRAILING_': 'value2',
            '__BOTH__': 'value3'
        };
        const result = convertEnvToIni(envData);
        expect(result).toEqual({
            '_LEADING': 'value1',
            'TRAILING_': 'value2',
            '__BOTH__': 'value3'
        });
    });

    it('should handle a key that conflicts with a section name', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const envData = {
            'DATABASE': 'this is a string',
            'DATABASE_HOST': 'localhost'
        };
        const result = convertEnvToIni(envData);
        expect(result).toEqual({
            DATABASE: {
                HOST: 'localhost'
            }
        });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Key "DATABASE" conflicts with a section name. The section will overwrite the top-level key.'
        );
        consoleWarnSpy.mockRestore();
    });

    it('should throw a TypeError for invalid input data', () => {
        expect(() => convertEnvToIni(null)).toThrow(TypeError);
        expect(() => convertEnvToIni('not an object')).toThrow('Input envData must be a non-null object.');
        expect(() => convertEnvToIni([])).toThrow('Input envData must be a non-null object.');
    });

    it('should throw a TypeError for invalid options', () => {
        expect(() => convertEnvToIni({}, { prefixDelimiter: 123 })).toThrow('options.prefixDelimiter must be a string.');
    });
  });
});