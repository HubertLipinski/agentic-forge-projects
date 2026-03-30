/**
 * @file src/diff/comparator.js
 * @description Core logic that compares the 'desired' schema state (from file) with the 'current' schema state (from DB) and produces a structured diff object.
 *
 * This module is the heart of the schema synchronization tool. It takes two standardized
 * schema objects—one representing the desired state from a configuration file, and one
 * representing the current state of a live database—and computes a detailed set of
 * differences. The output is a structured "diff" object that describes the precise
 * actions needed to migrate the current schema to the desired state. This diff object
 * is then used by the DDL generator to create the migration script.
 */

import { isEqual } from 'node:util';

/**
 * Compares two column definitions to identify changes.
 *
 * Normalizes certain database-specific type variations before comparison to avoid
*  unnecessary ALTER statements. For example, 'character varying' and 'varchar'
 * are treated as equivalent.
 *
 * @private
 * @param {object} desiredColumn - The desired column definition.
 * @param {object} currentColumn - The current column definition from the database.
 * @returns {object|null} A change object if differences are found, otherwise null.
 */
function _compareColumns(desiredColumn, currentColumn) {
  // Deep clone to avoid modifying the original objects during normalization.
  const desired = structuredClone(desiredColumn);
  const current = structuredClone(currentColumn);

  // Normalize types for comparison (e.g., 'character varying' vs 'varchar').
  // This list can be expanded as more database-specific variations are identified.
  const typeSynonyms = {
    'character varying': 'varchar',
    'integer': 'int',
  };

  if (desired.type in typeSynonyms) {
    desired.type = typeSynonyms[desired.type];
  }
  if (current.type in typeSynonyms) {
    current.type = typeSynonyms[current.type];
  }
  // Also handle cases like `varchar(255)`
  desired.type = desired.type.replace(/^character varying/, 'varchar');
  current.type = current.type.replace(/^character varying/, 'varchar');

  // Normalize boolean defaults (e.g., 'true'::boolean vs true)
  if (typeof current.default === 'string' && ['true', 'false'].includes(current.default.split('::')[0])) {
      current.default = (current.default.split('::')[0] === 'true');
  }

  const changes = {};
  if (desired.type !== current.type) {
    changes.type = { from: current.type, to: desired.type };
  }
  if (desired.nullable !== current.nullable) {
    changes.nullable = { from: current.nullable, to: desired.nullable };
  }
  // Note: Comparing default values can be tricky due to database-specific formatting.
  // This simple comparison works for many cases but might need refinement.
  // For example, `nextval('seq'::regclass)` vs `nextval('public.seq'::regclass)`.
  // We perform a basic string comparison for now.
  if (String(desired.default) !== String(current.default)) {
    changes.default = { from: current.default, to: desired.default };
  }

  if (Object.keys(changes).length > 0) {
    return {
      from: currentColumn,
      to: desiredColumn,
      changes,
    };
  }

  return null;
}

/**
 * Compares two index definitions to identify changes.
 * The primary comparison points are the columns included and the uniqueness constraint.
 *
 * @private
 * @param {object} desiredIndex - The desired index definition.
 * @param {object} currentIndex - The current index definition from the database.
 * @returns {boolean} `true` if the indexes are different, `false` otherwise.
 */
function _areIndexesDifferent(desiredIndex, currentIndex) {
  // Sort column arrays to ensure order doesn't cause a false difference.
  const desiredColumns = [...desiredIndex.columns].sort();
  const currentColumns = [...currentIndex.columns].sort();

  if (!isEqual(desiredColumns, currentColumns)) {
    return true;
  }

  // Compare uniqueness and primary key status.
  const desiredUnique = desiredIndex.unique ?? false;
  const currentUnique = currentIndex.unique ?? false;
  const desiredPrimary = desiredIndex.primary ?? false;
  const currentPrimary = currentIndex.primary ?? false;

  return desiredUnique !== currentUnique || desiredPrimary !== currentPrimary;
}

/**
 * Compares the desired schema state with the current database schema state
 * and produces a structured diff object detailing the necessary changes.
 *
 * The diff object is organized by change type (`add`, `drop`, `alter`) and
 * then by schema element (`tables`, `columns`, `indexes`). This structure
 * makes it easy for the DDL generator to process the changes in a logical order.
 *
 * @param {object} desiredSchema - The standardized schema object from the parser.
 * @param {object} currentSchema - The standardized schema object from the DB client.
 * @returns {object} A structured diff object.
 *
 * @example
 * // Returns a diff object like this:
 * {
 *   add: {
 *     tables: { 'new_table': { ...tableDef } },
 *     columns: { 'existing_table': { 'new_col': { ...colDef } } },
 *     indexes: { 'existing_table': { 'new_idx': { ...idxDef } } }
 *   },
 *   drop: {
 *     tables: { 'old_table': { ...tableDef } },
 *     columns: { 'existing_table': { 'old_col': { ...colDef } } },
 *     indexes: { 'existing_table': { 'old_idx': { ...idxDef } } }
 *   },
 *   alter: {
 *     columns: {
 *       'existing_table': {
 *         'modified_col': {
 *           from: { ...oldColDef },
 *           to: { ...newColDef },
 *           changes: { type: { from: 'int', to: 'bigint' } }
 *         }
 *       }
 *     }
 *   }
 * }
 */
export function compareSchemas(desiredSchema, currentSchema) {
  const diff = {
    add: { tables: {}, columns: {}, indexes: {} },
    drop: { tables: {}, columns: {}, indexes: {} },
    alter: { columns: {} },
  };

  const desiredTables = Object.keys(desiredSchema);
  const currentTables = Object.keys(currentSchema);

  // 1. Find tables to add
  for (const tableName of desiredTables) {
    if (!currentSchema[tableName]) {
      diff.add.tables[tableName] = desiredSchema[tableName];
    }
  }

  // 2. Find tables to drop
  for (const tableName of currentTables) {
    if (!desiredSchema[tableName]) {
      diff.drop.tables[tableName] = currentSchema[tableName];
    }
  }

  // 3. For existing tables, compare columns and indexes
  for (const tableName of desiredTables) {
    if (!currentSchema[tableName]) {
      continue; // This is a new table, handled by `add.tables`
    }

    const desiredTable = desiredSchema[tableName];
    const currentTable = currentSchema[tableName];

    // --- Compare Columns ---
    const desiredColumns = Object.keys(desiredTable.columns);
    const currentColumns = Object.keys(currentTable.columns);

    // Find columns to add
    for (const columnName of desiredColumns) {
      if (!currentTable.columns[columnName]) {
        if (!diff.add.columns[tableName]) diff.add.columns[tableName] = {};
        diff.add.columns[tableName][columnName] = desiredTable.columns[columnName];
      }
    }

    // Find columns to drop
    for (const columnName of currentColumns) {
      if (!desiredTable.columns[columnName]) {
        if (!diff.drop.columns[tableName]) diff.drop.columns[tableName] = {};
        diff.drop.columns[tableName][columnName] = currentTable.columns[columnName];
      }
    }

    // Find columns to alter
    for (const columnName of desiredColumns) {
      if (currentTable.columns[columnName]) {
        const change = _compareColumns(
          desiredTable.columns[columnName],
          currentTable.columns[columnName]
        );
        if (change) {
          if (!diff.alter.columns[tableName]) diff.alter.columns[tableName] = {};
          diff.alter.columns[tableName][columnName] = change;
        }
      }
    }

    // --- Compare Indexes ---
    const desiredIndexes = desiredTable.indexes ?? {};
    const currentIndexes = currentTable.indexes ?? {};

    // Find indexes to add or alter (alter is treated as drop + add)
    for (const indexName in desiredIndexes) {
      const desiredIndex = desiredIndexes[indexName];
      const currentIndex = currentIndexes[indexName];

      if (!currentIndex) {
        // Index to add
        if (!diff.add.indexes[tableName]) diff.add.indexes[tableName] = {};
        diff.add.indexes[tableName][indexName] = desiredIndex;
      } else if (_areIndexesDifferent(desiredIndex, currentIndex)) {
        // Index to alter: treat as drop and re-add
        if (!diff.drop.indexes[tableName]) diff.drop.indexes[tableName] = {};
        diff.drop.indexes[tableName][indexName] = currentIndex;
        if (!diff.add.indexes[tableName]) diff.add.indexes[tableName] = {};
        diff.add.indexes[tableName][indexName] = desiredIndex;
      }
    }

    // Find indexes to drop
    for (const indexName in currentIndexes) {
      if (!desiredIndexes[indexName]) {
        if (!diff.drop.indexes[tableName]) diff.drop.indexes[tableName] = {};
        diff.drop.indexes[tableName][indexName] = currentIndexes[indexName];
      }
    }
  }

  return diff;
}