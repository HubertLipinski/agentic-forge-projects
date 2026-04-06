/**
 * @file src/queries.js
 * @description Contains all SQL queries for introspecting the PostgreSQL schema.
 *
 * This module centralizes the SQL logic used to query PostgreSQL's
 * `information_schema` and `pg_catalog`. These queries are designed to be
 * robust and to fetch all necessary details about tables, columns, constraints,
 * and indexes in a structured way. Each query is exported as a named constant
 * for clarity and reusability.
 *
 * The queries are parameterized to allow for schema filtering, ensuring that
 * only relevant parts of the database are included in the snapshot.
 */

/**
 * @description
 * Fetches detailed information about all columns in the specified schemas.
 *
 * This query joins `information_schema.columns` with `pg_catalog` tables
 * to get comprehensive details that `information_schema` alone does not provide,
 * such as identity generation properties (e.g., 'ALWAYS' or 'BY DEFAULT').
 *
 * It retrieves:
 * - `table_schema`, `table_name`, `column_name`
 * - `ordinal_position` for correct column ordering.
 * - `column_default` for default values.
 * - `is_nullable` as a boolean.
 * - `data_type` and `udt_name` for type information.
 * - `character_maximum_length` for `varchar` and similar types.
 * - `numeric_precision`, `numeric_precision_radix`, `numeric_scale` for numeric types.
 * - `datetime_precision` for temporal types.
 * - `is_identity` and `identity_generation` for identity columns (PostgreSQL >= 10).
 *
 * Results are ordered by schema, table, and column position to ensure a
 * deterministic output.
 *
 * @param {string[]} schemas - An array of schema names to query.
 * @returns {{text: string, values: string[][]}} A query object with parameterized text and values.
 */
export const GET_COLUMNS_QUERY = `
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    (c.is_nullable = 'YES') AS is_nullable,
    c.data_type,
    c.udt_name,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_precision_radix,
    c.numeric_scale,
    c.datetime_precision,
    c.is_identity,
    c.identity_generation
  FROM
    information_schema.columns c
  WHERE
    c.table_schema = ANY($1)
  ORDER BY
    c.table_schema,
    c.table_name,
    c.ordinal_position;
`;

/**
 * @description
 * Fetches information about all constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)
 * for tables within the specified schemas.
 *
 * This query joins `information_schema.table_constraints` with related views
 * to gather details about each constraint, including the columns involved.
 *
 * It retrieves:
 * - `table_schema`, `table_name`
 * - `constraint_name`, `constraint_type`
 * - `columns`: An aggregated array of column names for the constraint.
 * - `foreign_table_schema`, `foreign_table_name`, `foreign_columns`: For FOREIGN KEY constraints.
 * - `check_clause`: The definition for CHECK constraints.
 *
 * The use of `ARRAY_AGG` and `ORDER BY` within the aggregate ensures that the
 * list of columns is sorted, contributing to a deterministic snapshot.
 *
 * @param {string[]} schemas - An array of schema names to query.
 * @returns {{text: string, values: string[][]}} A query object with parameterized text and values.
 */
export const GET_CONSTRAINTS_QUERY = `
  SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.columns,
    ccu.foreign_table_schema,
    ccu.foreign_table_name,
    ccu.foreign_columns,
    chk.check_clause
  FROM
    information_schema.table_constraints tc
  LEFT JOIN (
    SELECT
      table_schema,
      table_name,
      constraint_name,
      ARRAY_AGG(column_name ORDER BY ordinal_position) AS columns
    FROM
      information_schema.key_column_usage
    GROUP BY
      table_schema, table_name, constraint_name
  ) kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
  LEFT JOIN (
    SELECT
      rc.constraint_name,
      rc.constraint_schema,
      kcu2.table_schema AS foreign_table_schema,
      kcu2.table_name AS foreign_table_name,
      ARRAY_AGG(kcu2.column_name ORDER BY kcu2.ordinal_position) AS foreign_columns
    FROM
      information_schema.referential_constraints rc
    JOIN
      information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name AND rc.unique_constraint_schema = kcu2.constraint_schema
    GROUP BY
      rc.constraint_name, rc.constraint_schema, kcu2.table_schema, kcu2.table_name
  ) ccu ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
  LEFT JOIN
    information_schema.check_constraints chk ON tc.constraint_name = chk.constraint_name AND tc.constraint_schema = chk.constraint_schema
  WHERE
    tc.table_schema = ANY($1)
    AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
  ORDER BY
    tc.table_schema,
    tc.table_name,
    tc.constraint_name;
`;

/**
 * @description
 * Fetches detailed information about all indexes in the specified schemas.
 *
 * This query uses the `pg_catalog` views, which provide more comprehensive
 * index information than `information_schema`. It correctly handles expression-based
 * indexes and includes details like index type (e.g., BTREE, GIN) and uniqueness.
 *
 * It retrieves:
 * - `schema_name`, `table_name`, `index_name`
 * - `is_unique`: A boolean indicating if the index enforces uniqueness.
 * - `index_method`: The access method (e.g., 'btree').
 * - `index_definition`: The complete `CREATE INDEX` statement definition from `pg_get_indexdef`.
 *
 * Note: This query intentionally excludes indexes that are automatically created
 * to enforce PRIMARY KEY or UNIQUE constraints, as those are already captured
 * by `GET_CONSTRAINTS_QUERY`. This avoids redundancy in the final snapshot.
 *
 * @param {string[]} schemas - An array of schema names to query.
 * @returns {{text: string, values: string[][]}} A query object with parameterized text and values.
 */
export const GET_INDEXES_QUERY = `
  SELECT
    ns.nspname AS schema_name,
    t.relname AS table_name,
    i.relname AS index_name,
    ix.indisunique AS is_unique,
    am.amname AS index_method,
    pg_get_indexdef(i.oid) AS index_definition
  FROM
    pg_class t
  JOIN
    pg_index ix ON t.oid = ix.indrelid
  JOIN
    pg_class i ON i.oid = ix.indexrelid
  JOIN
    pg_namespace ns ON t.relnamespace = ns.oid
  JOIN
    pg_am am ON i.relam = am.oid
  WHERE
    ns.nspname = ANY($1)
    AND ix.indisprimary = false
    AND ix.indisunique = false
    AND NOT ix.indisexclusion
  ORDER BY
    ns.nspname,
    t.relname,
    i.relname;
`;