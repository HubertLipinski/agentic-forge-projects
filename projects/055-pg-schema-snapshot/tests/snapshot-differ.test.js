/**
 * @file tests/snapshot-differ.test.js
 * @description Unit tests for the diffing logic, comparing various JSON snapshot fixtures.
 *
 * These tests verify the functionality of the `snapshot-differ.js` module.
 * They use a series of structured JSON fixtures representing different schema
 * states (e.g., before and after adding a table, column, or constraint).
 * The tests ensure that the `diffSchemas` function correctly identifies and
 * formats additions, deletions, and modifications into clear, human-readable
 * strings, while correctly ignoring non-schema-related metadata.
 */

import { describe, it, expect } from 'node:test';
import { diffSchemas } from '../src/snapshot-differ.js';

// --- Test Fixtures ---

// A base schema snapshot. Other fixtures will be variations of this.
const baseSchema = {
  metadata: {
    capturedAt: '2023-10-26T10:00:00.000Z',
    schemas: ['public'],
  },
  tables: [
    {
      name: 'users',
      columns: [
        {
          name: 'id',
          type: 'int4',
          isNullable: false,
          defaultValue: "nextval('users_id_seq'::regclass)",
        },
        {
          name: 'username',
          type: 'varchar',
          isNullable: false,
          maxLength: 50,
        },
      ],
      constraints: [
        {
          name: 'users_pkey',
          type: 'PRIMARY KEY',
          columns: ['id'],
        },
        {
          name: 'users_username_key',
          type: 'UNIQUE',
          columns: ['username'],
        },
      ],
      indexes: [],
    },
  ],
};

describe('snapshot-differ', () => {
  describe('diffSchemas', () => {
    it('should return an empty array for identical schemas', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual([]);
    });

    it('should ignore differences in the metadata block', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.metadata.capturedAt = '2023-10-26T11:00:00.000Z'; // Different timestamp
      schema2.metadata.schemas = ['public', 'extra']; // Different schemas array

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual([]);
    });

    it('should detect an added table', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables.push({
        name: 'posts',
        columns: [],
        constraints: [],
        indexes: [],
      });

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[+] ADDED Table: posts']);
    });

    it('should detect a removed table', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = { ...structuredClone(baseSchema), tables: [] };

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[-] REMOVED Table: users']);
    });

    it('should detect an added column', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].columns.push({
        name: 'email',
        type: 'varchar',
        isNullable: true,
      });

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[+] ADDED Column: tables.0.columns.2.email']);
    });

    it('should detect a removed column', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].columns.pop(); // Remove 'username' column

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[-] REMOVED Column: tables.0.columns.1.username']);
    });

    it('should detect a modified column property (e.g., nullability)', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].columns[1].isNullable = true; // username is now nullable

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual([
        '[~] MODIFIED: tables.0.columns.1.isNullable from "false" to "true"',
      ]);
    });

    it('should detect a modified column property (e.g., type change)', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].columns[1].type = 'text'; // username varchar -> text

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual([
        '[~] MODIFIED: tables.0.columns.1.type from "varchar" to "text"',
      ]);
    });

    it('should detect an added constraint', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].constraints.push({
        name: 'users_email_check',
        type: 'CHECK',
        columns: ['email'],
        checkClause: "(email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')",
      });

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[+] ADDED Constraint: tables.0.constraints.2.users_email_check (CHECK)']);
    });

    it('should detect a removed constraint', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].constraints.pop(); // Remove 'users_username_key'

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[-] REMOVED Constraint: tables.0.constraints.1.users_username_key (UNIQUE)']);
    });

    it('should detect an added index', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);
      schema2.tables[0].indexes.push({
        name: 'users_username_gin_idx',
        method: 'gin',
        isUnique: false,
        definition: 'CREATE INDEX users_username_gin_idx ON public.users USING gin (username gin_trgm_ops)',
      });

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toEqual(['[+] ADDED Index: tables.0.indexes.0.users_username_gin_idx']);
    });

    it('should detect multiple changes correctly', () => {
      const schema1 = structuredClone(baseSchema);
      const schema2 = structuredClone(baseSchema);

      // 1. Modify a column
      schema2.tables[0].columns[0].type = 'int8'; // id: int4 -> int8

      // 2. Add a column
      schema2.tables[0].columns.push({
        name: 'last_login',
        type: 'timestamptz',
        isNullable: true,
      });

      // 3. Remove a constraint
      schema2.tables[0].constraints.pop();

      // 4. Add a table
      schema2.tables.push({
        name: 'audit_log',
        columns: [{ name: 'log_id', type: 'uuid' }],
        constraints: [],
        indexes: [],
      });

      const differences = diffSchemas(schema1, schema2);
      expect(differences).toHaveLength(4);
      expect(differences).toContain('[~] MODIFIED: tables.0.columns.0.type from "int4" to "int8"');
      expect(differences).toContain('[+] ADDED Column: tables.0.columns.2.last_login');
      expect(differences).toContain('[-] REMOVED Constraint: tables.0.constraints.1.users_username_key (UNIQUE)');
      expect(differences).toContain('[+] ADDED Table: audit_log');
    });

    it('should throw an error for invalid input', () => {
      expect(() => diffSchemas(null, {})).toThrow('Invalid input: Both schema1 and schema2 must be valid objects.');
      expect(() => diffSchemas({}, undefined)).toThrow('Invalid input: Both schema1 and schema2 must be valid objects.');
      expect(() => diffSchemas('string', {})).toThrow('Invalid input: Both schema1 and schema2 must be valid objects.');
    });
  });
});