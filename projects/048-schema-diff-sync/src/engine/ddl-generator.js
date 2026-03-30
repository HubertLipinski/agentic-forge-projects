/**
 * @file src/engine/ddl-generator.js
 * @description Generates DDL statements from a structured diff object.
 *
 * This module takes a structured diff object, which represents the difference
 * between a desired schema and a current database schema, and converts it into
 * an ordered list of DDL (Data Definition Language) statements. It orchestrates
 * the generation process by calling the appropriate methods on the provided
 * database client, ensuring that the generated DDL is specific to the target
 * database dialect (e.g., PostgreSQL or MySQL).
 */

import { BaseClient } from '../db/clients/base-client.js';

/**
 * Generates an ordered array of DDL statements from a schema diff.
 *
 * The function processes the diff in a specific order to avoid dependency issues:
 * 1. Drop indexes and constraints from tables that will be modified or dropped.
 * 2. Drop tables.
 * 3. Create new tables.
 * 4. Alter existing tables (add/drop/modify columns).
 * 5. Create new indexes and constraints.
 *
 * This order helps ensure that, for example, a column is not dropped while an
 * index still depends on it, and new indexes are created only after the table
 * and its columns are in their final state.
 *
 * @param {object} diff - The structured diff object from the comparator.
 *   Example diff structure:
 *   {
 *     tables: {
 *       add: { tableName: { columns: {...}, indexes: {...} } },
 *       drop: { tableName: { columns: {...}, indexes: {...} } },
 *       modify: {
 *         tableName: {
 *           columns: {
 *             add: { colName: {...} },
 *             drop: { colName: {...} },
 *             alter: { colName: { from: {...}, to: {...} } }
 *           },
 *           indexes: {
 *             add: { indexName: {...} },
 *             drop: { indexName: {...} }
 *           }
 *         }
 *       }
 *     }
 *   }
 * @param {BaseClient} dbClient - An instance of a database client (e.g., PostgresClient).
 * @returns {string[]} An array of DDL statements.
 */
export function generateDDL(diff, dbClient) {
  if (!diff || !diff.tables) {
    return [];
  }

  const ddlStatements = [];
  const { add, drop, modify } = diff.tables;

  // --- Phase 1: Drop dependent objects (indexes/constraints) ---
  // Drop indexes from tables that will be dropped entirely.
  for (const [tableName, tableDef] of Object.entries(drop)) {
    for (const [indexName, indexDef] of Object.entries(tableDef.indexes)) {
      ddlStatements.push(dbClient.generateDropIndexDDL(tableName, indexName, indexDef));
    }
  }
  // Drop indexes from tables that are being modified.
  for (const [tableName, tableChanges] of Object.entries(modify)) {
    for (const [indexName, indexDef] of Object.entries(tableChanges.indexes.drop)) {
      ddlStatements.push(dbClient.generateDropIndexDDL(tableName, indexName, indexDef));
    }
  }

  // --- Phase 2: Drop tables ---
  for (const tableName of Object.keys(drop)) {
    ddlStatements.push(dbClient.generateDropTableDDL(tableName));
  }

  // --- Phase 3: Create new tables ---
  for (const [tableName, tableDefinition] of Object.entries(add)) {
    ddlStatements.push(dbClient.generateCreateTableDDL(tableName, tableDefinition));
  }

  // --- Phase 4: Alter existing tables (columns) ---
  for (const [tableName, tableChanges] of Object.entries(modify)) {
    const { columns } = tableChanges;

    // Drop columns
    for (const columnName of Object.keys(columns.drop)) {
      ddlStatements.push(dbClient.generateDropColumnDDL(tableName, columnName));
    }

    // Add columns
    for (const [columnName, columnDefinition] of Object.entries(columns.add)) {
      ddlStatements.push(dbClient.generateAddColumnDDL(tableName, columnName, columnDefinition));
    }

    // Alter columns
    for (const [columnName, change] of Object.entries(columns.alter)) {
      const alterDDLs = dbClient.generateAlterColumnDDL(tableName, columnName, change.from, change.to);
      ddlStatements.push(...alterDDLs);
    }
  }

  // --- Phase 5: Create new indexes and constraints ---
  // Add indexes to newly created tables.
  for (const [tableName, tableDefinition] of Object.entries(add)) {
    for (const [indexName, indexDefinition] of Object.entries(tableDefinition.indexes)) {
      ddlStatements.push(dbClient.generateAddIndexDDL(tableName, indexName, indexDefinition));
    }
  }
  // Add indexes to modified tables.
  for (const [tableName, tableChanges] of Object.entries(modify)) {
    for (const [indexName, indexDefinition] of Object.entries(tableChanges.indexes.add)) {
      ddlStatements.push(dbClient.generateAddIndexDDL(tableName, indexName, indexDefinition));
    }
  }

  // Filter out any empty strings that might be returned by client methods.
  return ddlStatements.filter(ddl => ddl && ddl.trim() !== '');
}