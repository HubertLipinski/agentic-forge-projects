/**
 * @file src/schema/parser.js
 * @description Parses the user-provided declarative schema file (JSON/YAML) into a standardized internal representation.
 *
 * This module handles reading the schema definition file, parsing it as either
 * YAML or JSON based on its extension, and validating its structure. It then
 * normalizes the schema into a consistent format that the rest of the application,
 * particularly the comparator, can reliably work with.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * Custom error class for schema parsing and validation issues.
 */
class SchemaParseError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'SchemaParseError';
  }
}

/**
 * Parses the raw content of a schema file based on its extension.
 * Supports YAML (.yml, .yaml) and JSON (.json).
 *
 * @private
 * @param {string} rawContent - The raw string content of the schema file.
 * @param {string} filePath - The path to the schema file, used to determine format.
 * @returns {object} The parsed schema object.
 * @throws {SchemaParseError} If the file format is unsupported or parsing fails.
 */
function _parseSchemaContent(rawContent, filePath) {
  const extension = path.extname(filePath).toLowerCase();

  try {
    if (extension === '.yml' || extension === '.yaml') {
      const parsed = yaml.load(rawContent);
      if (parsed === null || typeof parsed !== 'object') {
        throw new SchemaParseError('YAML file is empty or does not resolve to an object.');
      }
      return parsed;
    }
    if (extension === '.json') {
      return JSON.parse(rawContent);
    }
  } catch (parseError) {
    throw new SchemaParseError(`Failed to parse schema file '${filePath}': ${parseError.message}`);
  }

  throw new SchemaParseError(`Unsupported schema file format: '${extension}'. Please use .yml, .yaml, or .json.`);
}

/**
 * Validates the structure of a single table definition within the schema.
 *
 * @private
 * @param {string} tableName - The name of the table being validated.
 * @param {object} tableDef - The definition of the table.
 * @throws {SchemaParseError} If the table definition is invalid.
 */
function _validateTableDefinition(tableName, tableDef) {
  if (!tableDef || typeof tableDef !== 'object') {
    throw new SchemaParseError(`Table '${tableName}' definition must be an object.`);
  }

  if (!tableDef.columns || typeof tableDef.columns !== 'object' || Object.keys(tableDef.columns).length === 0) {
    throw new SchemaParseError(`Table '${tableName}' must have a non-empty 'columns' object.`);
  }

  for (const [columnName, colDef] of Object.entries(tableDef.columns)) {
    if (!colDef || typeof colDef !== 'object') {
      throw new SchemaParseError(`Column '${columnName}' in table '${tableName}' must be an object.`);
    }
    if (typeof colDef.type !== 'string' || colDef.type.trim() === '') {
      throw new SchemaParseError(`Column '${columnName}' in table '${tableName}' must have a 'type' string.`);
    }
  }

  if (tableDef.indexes && typeof tableDef.indexes !== 'object') {
    throw new SchemaParseError(`The 'indexes' property for table '${tableName}' must be an object if provided.`);
  }

  if (tableDef.indexes) {
    for (const [indexName, indexDef] of Object.entries(tableDef.indexes)) {
      if (!indexDef || typeof indexDef !== 'object') {
        throw new SchemaParseError(`Index '${indexName}' in table '${tableName}' must be an object.`);
      }
      if (!Array.isArray(indexDef.columns) || indexDef.columns.length === 0) {
        throw new SchemaParseError(`Index '${indexName}' in table '${tableName}' must have a non-empty 'columns' array.`);
      }
      if (indexDef.columns.some(col => typeof col !== 'string')) {
        throw new SchemaParseError(`All column names in index '${indexName}' for table '${tableName}' must be strings.`);
      }
    }
  }
}

/**
 * Normalizes the parsed schema into a standardized internal representation.
 * This ensures that optional fields have consistent default values (e.g., `nullable: true`).
 *
 * @private
 * @param {object} parsedSchema - The raw schema object after parsing.
 * @returns {object} The normalized schema object.
 */
function _normalizeSchema(parsedSchema) {
  const normalizedSchema = {};

  for (const [tableName, tableDef] of Object.entries(parsedSchema)) {
    _validateTableDefinition(tableName, tableDef);

    const normalizedTable = {
      columns: {},
      indexes: {},
    };

    // Normalize columns
    for (const [columnName, colDef] of Object.entries(tableDef.columns)) {
      normalizedTable.columns[columnName] = {
        type: colDef.type,
        nullable: colDef.nullable ?? true,
        default: colDef.default ?? null,
        primary: colDef.primary ?? false,
        unique: colDef.unique ?? false,
        autoIncrement: colDef.autoIncrement ?? false,
      };
    }

    // Normalize indexes
    if (tableDef.indexes) {
      for (const [indexName, indexDef] of Object.entries(tableDef.indexes)) {
        normalizedTable.indexes[indexName] = {
          columns: [...indexDef.columns], // Ensure it's a new array
          unique: indexDef.unique ?? false,
          primary: indexDef.primary ?? false,
        };
      }
    }

    normalizedSchema[tableName] = normalizedTable;
  }

  return normalizedSchema;
}

/**
 * Reads, parses, validates, and normalizes a declarative schema file.
 *
 * This is the main exported function of the module. It orchestrates the entire
 * process of converting a schema file on disk into a standardized, in-memory
 * representation that the application can use for comparison.
 *
 * @param {string} schemaPath - The absolute path to the schema file (JSON or YAML).
 * @returns {Promise<object>} A promise that resolves to the standardized schema object.
 * @throws {SchemaParseError} If the file cannot be read, parsed, or validated.
 */
export async function parseSchema(schemaPath) {
  let rawContent;
  try {
    rawContent = await readFile(schemaPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new SchemaParseError(`Schema file not found at '${schemaPath}'.`);
    }
    throw new SchemaParseError(`Failed to read schema file '${schemaPath}': ${error.message}`);
  }

  const parsedSchema = _parseSchemaContent(rawContent, schemaPath);

  if (!parsedSchema || typeof parsedSchema !== 'object' || Object.keys(parsedSchema).length === 0) {
    throw new SchemaParseError(`Schema file '${schemaPath}' is empty or does not contain any table definitions.`);
  }

  const normalizedSchema = _normalizeSchema(parsedSchema);

  return normalizedSchema;
}