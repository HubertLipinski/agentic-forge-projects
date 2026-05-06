/**
 * @file src/transformer/schema-transformer.js
 * @description Transforms JSDoc type information into valid AJV JSON Schema objects.
 *
 * This module is responsible for the critical task of interpreting the type
 * strings found in JSDoc tags (`@param`, `@returns`, etc.) and converting them
 * into a structured, machine-readable format: JSON Schema. This schema is then
 * used by AJV (Another JSON Schema Validator) in the generated Express server
 * to validate incoming request data (body, query parameters, path parameters)
 * and to serialize response bodies.
 */

/**
 * A cache for parsed schemas to avoid redundant processing of the same type string.
 * This is particularly useful for complex object literals that might be reused.
 * @type {Map<string, object>}
 */
const schemaCache = new Map();

/**
 * Maps common JavaScript primitive types and JSDoc types to their corresponding
 * JSON Schema type names. This provides a quick lookup for simple type conversions.
 * @type {Object<string, string>}
 */
const JSDOC_TO_JSON_SCHEMA_TYPE_MAP = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
  null: 'null',
};

/**
 * Parses a JSDoc type string (e.g., from `@param {string}`) and transforms it
 * into a valid JSON Schema object.
 *
 * This function handles three main cases:
 * 1. Simple primitive types (`string`, `number`, etc.).
 * 2. Object literals defining a schema directly (`{type: 'string', minLength: 2}`).
 * 3. Union types (`string|number`), which are transformed into `oneOf` or `type` arrays.
 *
 * It uses a cache to avoid re-parsing identical type strings.
 *
 * @param {string} typeString - The type string from a JSDoc tag.
 * @returns {object | null} A JSON Schema object, or null if the type string is empty,
 *          'void', or 'undefined', indicating no schema should be generated.
 */
export function transformJSDocTypeToSchema(typeString) {
  if (!typeString || typeString === 'void' || typeString === 'undefined') {
    return null;
  }

  const trimmedType = typeString.trim();

  if (schemaCache.has(trimmedType)) {
    // Return a deep copy to prevent subsequent modifications from polluting the cache.
    return structuredClone(schemaCache.get(trimmedType));
  }

  let schema;

  // Case 1: It's an object literal, e.g., `{type: 'string', ...}`
  if (trimmedType.startsWith('{') && trimmedType.endsWith('}')) {
    schema = parseObjectLiteralType(trimmedType);
  }
  // Case 2: It's a union type, e.g., `string|number` or `string | null`
  else if (trimmedType.includes('|')) {
    schema = parseUnionType(trimmedType);
  }
  // Case 3: It's a simple type name, e.g., `string`, `number[]`, `MyType`
  else {
    schema = parseSimpleType(trimmedType);
  }

  if (schema) {
    schemaCache.set(trimmedType, structuredClone(schema));
  }

  return schema;
}

/**
 * Parses a JSDoc type string that is an object literal.
 * This uses a sandboxed Function constructor to safely evaluate the string as
 * a JavaScript object, which is more forgiving than `JSON.parse`.
 *
 * @param {string} objectLiteralString - The string representation of the object (e.g., "{type: 'string'}").
 * @returns {object} The parsed object, which is assumed to be a valid JSON Schema fragment.
 */
function parseObjectLiteralType(objectLiteralString) {
  try {
    // This is a relatively safe way to parse a JavaScript object literal
    // without using `eval`. It's sandboxed as it can't access outer scope.
    // It's more flexible than JSON.parse (e.g., allows unquoted keys).
    const schema = new Function(`return ${objectLiteralString}`)();
    if (typeof schema !== 'object' || schema === null) {
      throw new Error('The evaluated expression is not an object.');
    }
    return schema;
  } catch (error) {
    console.warn(
      `[SchemaTransformer] Failed to parse JSDoc object literal "${objectLiteralString}". Defaulting to a generic object schema. Error: ${error.message}`,
    );
    // Provide a fallback schema if parsing fails.
    return { type: 'object' };
  }
}

/**
 * Parses a JSDoc union type string (e.g., `string|number|null`).
 *
 * It splits the string by the pipe `|` character and attempts to parse each
 * part as a simple type. It then combines them into a JSON Schema `oneOf`
 * construct or a `type` array if all types are simple primitives.
 *
 * @param {string} unionTypeString - The union type string.
 * @returns {object} A JSON Schema object representing the union.
 */
function parseUnionType(unionTypeString) {
  const types = unionTypeString.split('|').map((t) => t.trim());
  const schemas = types
    .map((type) => parseSimpleType(type))
    .filter(Boolean);

  // Optimization: If all sub-schemas are just simple `{ "type": "..." }` objects,
  // we can combine them into a single schema with a `type` array.
  // e.g., `string|number` becomes `{ "type": ["string", "number"] }`
  const areAllSimpleTypes = schemas.every(
    (s) => Object.keys(s).length === 1 && s.type,
  );

  if (areAllSimpleTypes) {
    return {
      type: schemas.map((s) => s.type),
    };
  }

  // For more complex combinations (e.g., `string|{type: 'object'}`), use `oneOf`.
  return {
    oneOf: schemas,
  };
}

/**
 * Parses a simple JSDoc type name, including array notation.
 *
 * - `string` -> `{ "type": "string" }`
 * - `number[]` -> `{ "type": "array", "items": { "type": "number" } }`
 * - `MyCustomType` -> `{ "type": "object" }` (as a fallback)
 *
 * @param {string} simpleTypeString - The simple type string.
 * @returns {object | null} A JSON Schema object for the simple type, or null if invalid.
 */
function parseSimpleType(simpleTypeString) {
  if (!simpleTypeString) {
    return null;
  }

  // Handle array notation, e.g., `string[]` or `Array<string>`
  const arrayMatch =
    simpleTypeString.match(/^(.*)\[\]$/) ||
    simpleTypeString.match(/^Array<(.*)>$/);

  if (arrayMatch) {
    const itemType = arrayMatch[1].trim();
    // Recursively parse the item type.
    const itemSchema = transformJSDocTypeToSchema(itemType);
    return {
      type: 'array',
      items: itemSchema || {}, // `items: {}` allows any type if subtype is unknown.
    };
  }

  const lowerType = simpleTypeString.toLowerCase();
  if (JSDOC_TO_JSON_SCHEMA_TYPE_MAP[lowerType]) {
    return { type: JSDOC_TO_JSON_SCHEMA_TYPE_MAP[lowerType] };
  }

  // Fallback for unrecognized types (e.g., custom class names like `User`).
  // We assume it's an object, as this is the most common case for custom types.
  // A more advanced system might look up definitions for these types.
  console.warn(
    `[SchemaTransformer] Unrecognized JSDoc type "${simpleTypeString}". Defaulting to a generic object schema.`,
  );
  return { type: 'object' };
}

/**
 * Clears the internal schema cache. Primarily useful for testing purposes
 * to ensure a clean state between test runs.
 */
export function clearSchemaCache() {
  schemaCache.clear();
}