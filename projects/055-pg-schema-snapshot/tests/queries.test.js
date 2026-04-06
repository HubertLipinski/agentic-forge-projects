/**
 * @file tests/queries.test.js
 * @description Unit tests for the SQL queries defined in `src/queries.js`.
 *
 * These tests are designed to be simple and fast. Their primary purpose is to
 * verify that the exported query objects are well-formed and contain valid,
 * non-empty SQL strings. They act as a basic sanity check and a guard against
 * accidental deletion or malformation of the query constants, ensuring that the
 * core SQL logic remains intact.
 *
 * These tests do not execute the queries against a database, as that would
 * fall into the category of integration testing and require a database connection.
 */

import { describe, it, expect } from 'node:test';
import *s as queries from '../src/queries.js';

describe('SQL Queries', () => {
  describe('GET_COLUMNS_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof queries.GET_COLUMNS_QUERY).toBe('string');
      expect(queries.GET_COLUMNS_QUERY.trim().length).toBeGreaterThan(0);
    });

    it('should contain essential keywords for fetching columns', () => {
      const query = queries.GET_COLUMNS_QUERY.toUpperCase();
      expect(query).toContain('SELECT');
      expect(query).toContain('FROM INFORMATION_SCHEMA.COLUMNS');
      expect(query).toContain('WHERE C.TABLE_SCHEMA = ANY($1)');
      expect(query).toContain('ORDER BY');
    });

    it('should select the required column properties', () => {
      const query = queries.GET_COLUMNS_QUERY;
      expect(query).toMatch(/c\.table_schema/i);
      expect(query).toMatch(/c\.table_name/i);
      expect(query).toMatch(/c\.column_name/i);
      expect(query).toMatch(/c\.ordinal_position/i);
      expect(query).toMatch(/c\.column_default/i);
      expect(query).toMatch(/c\.is_nullable/i);
      expect(query).toMatch(/c\.data_type/i);
      expect(query).toMatch(/c\.udt_name/i);
    });
  });

  describe('GET_CONSTRAINTS_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof queries.GET_CONSTRAINTS_QUERY).toBe('string');
      expect(queries.GET_CONSTRAINTS_QUERY.trim().length).toBeGreaterThan(0);
    });

    it('should contain essential keywords for fetching constraints', () => {
      const query = queries.GET_CONSTRAINTS_QUERY.toUpperCase();
      expect(query).toContain('SELECT');
      expect(query).toContain('FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS');
      expect(query).toContain('LEFT JOIN');
      expect(query).toContain('WHERE TC.TABLE_SCHEMA = ANY($1)');
      expect(query).toContain('ORDER BY');
    });

    it('should filter for specific constraint types', () => {
      const query = queries.GET_CONSTRAINTS_QUERY;
      expect(query).toContain(
        "tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')",
      );
    });

    it('should use ARRAY_AGG to collect column names', () => {
      const query = queries.GET_CONSTRAINTS_QUERY;
      expect(query).toContain('ARRAY_AGG(column_name ORDER BY ordinal_position)');
    });
  });

  describe('GET_INDEXES_QUERY', () => {
    it('should be a non-empty string', () => {
      expect(typeof queries.GET_INDEXES_QUERY).toBe('string');
      expect(queries.GET_INDEXES_QUERY.trim().length).toBeGreaterThan(0);
    });

    it('should query pg_catalog tables for index information', () => {
      const query = queries.GET_INDEXES_QUERY.toUpperCase();
      expect(query).toContain('SELECT');
      expect(query).toContain('FROM PG_CLASS T');
      expect(query).toContain('JOIN PG_INDEX IX');
      expect(query).toContain('JOIN PG_NAMESPACE NS');
      expect(query).toContain('WHERE NS.NSPNAME = ANY($1)');
      expect(query).toContain('ORDER BY');
    });

    it('should exclude primary key and unique constraint indexes to avoid duplication', () => {
      const query = queries.GET_INDEXES_QUERY;
      expect(query).toContain('ix.indisprimary = false');
      expect(query).toContain('ix.indisunique = false');
    });

    it('should fetch the index definition using pg_get_indexdef', () => {
      const query = queries.GET_INDEXES_QUERY;
      expect(query).toContain('pg_get_indexdef(i.oid) AS index_definition');
    });
  });

  it('should export only the expected queries', () => {
    const exportedKeys = Object.keys(queries);
    const expectedKeys = [
      'GET_COLUMNS_QUERY',
      'GET_CONSTRAINTS_QUERY',
      'GET_INDEXES_QUERY',
    ];
    expect(exportedKeys.sort()).toEqual(expectedKeys.sort());
  });
});