/**
 * @file tests/schema-extractor.test.js
 * @description Integration tests for the schema extractor.
 *
 * These tests verify the core transformation logic of the `schema-extractor.js` module.
 * They use a mock PostgreSQL client to simulate database responses, allowing for focused
 * testing of how raw query results are processed, structured, and sorted into the final
 * JSON snapshot format. The goal is to ensure the extractor correctly assembles the
 * schema object from disparate query results and produces a deterministic, well-formed output.
 */

import { describe, it, expect, mock } from 'node:test';
import { extractSchema } from '../src/schema-extractor.js';

// --- Mock Data ---
// This data simulates the raw rows returned by the pg driver for our queries.

const mockColumnRows = [
  {
    table_schema: 'public',
    table_name: 'users',
    column_name: 'id',
    ordinal_position: 1,
    column_default: "nextval('users_id_seq'::regclass)",
    is_nullable: false,
    data_type: 'integer',
    udt_name: 'int4',
    character_maximum_length: null,
    numeric_precision: 32,
    numeric_precision_radix: 2,
    numeric_scale: 0,
    datetime_precision: null,
    is_identity: 'NO',
    identity_generation: null,
  },
  {
    table_schema: 'public',
    table_name: 'users',
    column_name: 'username',
    ordinal_position: 2,
    column_default: null,
    is_nullable: false,
    data_type: 'character varying',
    udt_name: 'varchar',
    character_maximum_length: 50,
    numeric_precision: null,
    numeric_precision_radix: null,
    numeric_scale: null,
    datetime_precision: null,
    is_identity: 'NO',
    identity_generation: null,
  },
  {
    table_schema: 'public',
    table_name: 'users',
    column_name: 'created_at',
    ordinal_position: 3,
    column_default: 'now()',
    is_nullable: false,
    data_type: 'timestamp with time zone',
    udt_name: 'timestamptz',
    character_maximum_length: null,
    numeric_precision: null,
    numeric_precision_radix: null,
    numeric_scale: null,
    datetime_precision: 6,
    is_identity: 'NO',
    identity_generation: null,
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    column_name: 'id',
    ordinal_position: 1,
    column_default: null,
    is_nullable: false,
    data_type: 'integer',
    udt_name: 'int4',
    character_maximum_length: null,
    numeric_precision: 32,
    numeric_precision_radix: 2,
    numeric_scale: 0,
    datetime_precision: null,
    is_identity: 'YES',
    identity_generation: 'ALWAYS',
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    column_name: 'user_id',
    ordinal_position: 2,
    column_default: null,
    is_nullable: false,
    data_type: 'integer',
    udt_name: 'int4',
    character_maximum_length: null,
    numeric_precision: 32,
    numeric_precision_radix: 2,
    numeric_scale: 0,
    datetime_precision: null,
    is_identity: 'NO',
    identity_generation: null,
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    column_name: 'content',
    ordinal_position: 3,
    column_default: null,
    is_nullable: true,
    data_type: 'text',
    udt_name: 'text',
    character_maximum_length: null,
    numeric_precision: null,
    numeric_precision_radix: null,
    numeric_scale: null,
    datetime_precision: null,
    is_identity: 'NO',
    identity_generation: null,
  },
];

const mockConstraintRows = [
  {
    table_schema: 'public',
    table_name: 'users',
    constraint_name: 'users_pkey',
    constraint_type: 'PRIMARY KEY',
    columns: ['id'],
    foreign_table_schema: null,
    foreign_table_name: null,
    foreign_columns: null,
    check_clause: null,
  },
  {
    table_schema: 'public',
    table_name: 'users',
    constraint_name: 'users_username_key',
    constraint_type: 'UNIQUE',
    columns: ['username'],
    foreign_table_schema: null,
    foreign_table_name: null,
    foreign_columns: null,
    check_clause: null,
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    constraint_name: 'posts_pkey',
    constraint_type: 'PRIMARY KEY',
    columns: ['id'],
    foreign_table_schema: null,
    foreign_table_name: null,
    foreign_columns: null,
    check_clause: null,
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    constraint_name: 'posts_user_id_fkey',
    constraint_type: 'FOREIGN KEY',
    columns: ['user_id'],
    foreign_table_schema: 'public',
    foreign_table_name: 'users',
    foreign_columns: ['id'],
    check_clause: null,
  },
  {
    table_schema: 'public',
    table_name: 'posts',
    constraint_name: 'content_not_empty',
    constraint_type: 'CHECK',
    columns: ['content'],
    foreign_table_schema: null,
    foreign_table_name: null,
    foreign_columns: null,
    check_clause: "((content IS NOT NULL) AND (content <> ''::text))",
  },
];

const mockIndexRows = [
  {
    schema_name: 'public',
    table_name: 'users',
    index_name: 'users_created_at_idx',
    is_unique: false,
    index_method: 'btree',
    index_definition: 'CREATE INDEX users_created_at_idx ON public.users USING btree (created_at)',
  },
  // This index is on a table not in the mock columns to test resilience
  {
    schema_name: 'public',
    table_name: 'comments',
    index_name: 'comments_post_id_idx',
    is_unique: false,
    index_method: 'btree',
    index_definition: 'CREATE INDEX comments_post_id_idx ON public.comments USING btree (post_id)',
  },
];

/**
 * Creates a mock PostgreSQL client. The client's `query` method is a mock function
 * that returns predefined data based on the SQL query text it receives.
 *
 * @param {object} [data] - Optional data to override the default mock responses.
 * @param {Array} [data.columns] - Rows for the columns query.
 * @param {Array} [data.constraints] - Rows for the constraints query.
 * @param {Array} [data.indexes] - Rows for the indexes query.
 * @returns {object} A mock client object with a mocked `query` method.
 */
const createMockClient = (data = {}) => {
  const {
    columns = mockColumnRows,
    constraints = mockConstraintRows,
    indexes = mockIndexRows,
  } = data;

  const query = mock.fn((queryText, _params) => {
    if (queryText.includes('information_schema.columns')) {
      return Promise.resolve({ rows: columns });
    }
    if (queryText.includes('information_schema.table_constraints')) {
      return Promise.resolve({ rows: constraints });
    }
    if (queryText.includes('pg_catalog')) {
      return Promise.resolve({ rows: indexes });
    }
    return Promise.reject(new Error(`Mock client does not handle query: ${queryText}`));
  });

  return { query };
};

describe('schema-extractor', () => {
  it('should produce a structured and sorted schema from raw query results', async () => {
    const mockClient = createMockClient();
    const options = { includeSchemas: ['public'] };

    const schema = await extractSchema(mockClient, options);

    // Verify metadata
    expect(typeof schema.metadata.capturedAt).toBe('string');
    expect(schema.metadata.schemas).toEqual(['public']);

    // Verify tables (sorted by name)
    expect(schema.tables.length).toBe(2);
    expect(schema.tables[0].name).toBe('posts');
    expect(schema.tables[1].name).toBe('users');

    // --- Verify 'posts' table ---
    const postsTable = schema.tables[0];
    expect(postsTable.columns.length).toBe(3);
    expect(postsTable.constraints.length).toBe(3);
    expect(postsTable.indexes.length).toBe(0); // No non-constraint indexes for this table

    // Verify columns (sorted by name)
    expect(postsTable.columns[0].name).toBe('content');
    expect(postsTable.columns[1].name).toBe('id');
    expect(postsTable.columns[2].name).toBe('user_id');

    // Check specific column details
    const idColumnPosts = postsTable.columns.find(c => c.name === 'id');
    expect(idColumnPosts.type).toBe('int4');
    expect(idColumnPosts.isNullable).toBe(false);
    expect(idColumnPosts.isIdentity).toBe(true);
    expect(idColumnPosts.identityGeneration).toBe('ALWAYS');
    expect(idColumnPosts.defaultValue).toBe(undefined); // Default value is null for identity columns

    const contentColumn = postsTable.columns.find(c => c.name === 'content');
    expect(contentColumn.type).toBe('text');
    expect(contentColumn.isNullable).toBe(true);

    // Verify constraints (sorted by name)
    expect(postsTable.constraints[0].name).toBe('content_not_empty');
    expect(postsTable.constraints[1].name).toBe('posts_pkey');
    expect(postsTable.constraints[2].name).toBe('posts_user_id_fkey');

    // Check specific constraint details
    const fkConstraint = postsTable.constraints.find(c => c.type === 'FOREIGN KEY');
    expect(fkConstraint.columns).toEqual(['user_id']);
    expect(fkConstraint.references).toEqual({ table: 'users', columns: ['id'] });

    const checkConstraint = postsTable.constraints.find(c => c.type === 'CHECK');
    expect(checkConstraint.checkClause).toBe("((content IS NOT NULL) AND (content <> ''::text))");

    // --- Verify 'users' table ---
    const usersTable = schema.tables[1];
    expect(usersTable.columns.length).toBe(3);
    expect(usersTable.constraints.length).toBe(2);
    expect(usersTable.indexes.length).toBe(1);

    // Verify columns (sorted by name)
    expect(usersTable.columns[0].name).toBe('created_at');
    expect(usersTable.columns[1].name).toBe('id');
    expect(usersTable.columns[2].name).toBe('username');

    // Check specific column details
    const createdAtCol = usersTable.columns.find(c => c.name === 'created_at');
    expect(createdAtCol.type).toBe('timestamptz');
    expect(createdAtCol.defaultValue).toBe('now()');
    expect(createdAtCol.datetimePrecision).toBe(6);

    const usernameCol = usersTable.columns.find(c => c.name === 'username');
    expect(usernameCol.type).toBe('varchar');
    expect(usernameCol.maxLength).toBe(50);

    // Verify constraints (sorted by name)
    expect(usersTable.constraints[0].name).toBe('users_pkey');
    expect(usersTable.constraints[1].name).toBe('users_username_key');

    // Verify indexes (sorted by name)
    expect(usersTable.indexes[0].name).toBe('users_created_at_idx');
    expect(usersTable.indexes[0].method).toBe('btree');
    expect(usersTable.indexes[0].isUnique).toBe(false);
    expect(usersTable.indexes[0].definition).toContain('users_created_at_idx');
  });

  it('should handle empty query results gracefully', async () => {
    const mockClient = createMockClient({ columns: [], constraints: [], indexes: [] });
    const options = { includeSchemas: ['public'] };

    const schema = await extractSchema(mockClient, options);

    expect(schema.metadata.schemas).toEqual(['public']);
    expect(schema.tables).toEqual([]);
    expect(mockClient.query.mock.callCount()).toBe(3);
  });

  it('should return an empty result if no schemas are left after filtering', async () => {
    const mockClient = createMockClient();
    const options = { includeSchemas: ['public'], excludeSchemas: ['public'] };

    const schema = await extractSchema(mockClient, options);

    expect(schema.metadata.schemas).toEqual([]);
    expect(schema.tables).toEqual([]);
    // Should not even query the DB if there are no schemas to query
    expect(mockClient.query.mock.callCount()).toBe(0);
  });

  it('should throw an error if database query fails', async () => {
    const errorMessage = 'Connection refused';
    const mockClient = {
      query: mock.fn(() => Promise.reject(new Error(errorMessage))),
    };

    await expect(
      extractSchema(mockClient, { includeSchemas: ['public'] }),
    ).rejects.toThrow(`Failed to extract schema from the database. Reason: ${errorMessage}`);
  });

  it('should throw an error for invalid options', async () => {
    const mockClient = createMockClient();

    await expect(
      extractSchema(mockClient, { includeSchemas: 'not-an-array' }),
    ).rejects.toThrow('Invalid options: includeSchemas and excludeSchemas must be arrays.');

    await expect(
      extractSchema(mockClient, { includeSchemas: ['public'], excludeSchemas: {} }),
    ).rejects.toThrow('Invalid options: includeSchemas and excludeSchemas must be arrays.');
  });

  it('should correctly filter schemas based on include/exclude options', async () => {
    const mockClient = createMockClient();
    const options = { includeSchemas: ['public', 'internal'], excludeSchemas: ['internal'] };

    await extractSchema(mockClient, options);

    // Verify that the query was called with the correct, filtered list of schemas
    const queryCall = mockClient.query.mock.calls[0];
    const params = queryCall.arguments[1];
    expect(params).toEqual([['public']]);
  });
});