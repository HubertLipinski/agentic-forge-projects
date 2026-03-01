/**
 * @file src/generator/zod-builder.js
 * @description Takes parsed JSDoc type information and constructs a string representation of the equivalent Zod schema.
 */

import { JSDOC_TO_ZOD_TYPE_MAP } from '../constants.js';

/**
 * Recursively parses a JSDoc type string and converts it into a Zod schema string.
 * This is the core of the type conversion logic, handling primitives, arrays, and nested objects.
 *
 * @param {string} type - The JSDoc type string (e.g., "string", "number[]", "Object.<string, any>").
 * @returns {string} The corresponding Zod schema string (e.g., "z.string()", "z.array(z.number())", "z.record(z.any())").
 */
function buildZodSchemaPart(type) {
  if (typeof type !== 'string' || !type) {
    return 'z.any()';
  }

  const trimmedType = type.trim();

  // Handle Array syntax: string[], Array<string>, Array.<string>
  const arrayMatch = trimmedType.match(/^(?:Array<(.+)>|Array\.<(.+)>|(.+)\[\])$/);
  if (arrayMatch) {
    // Find the first non-undefined capture group to get the inner type
    const innerType = arrayMatch[1] ?? arrayMatch[2] ?? arrayMatch[3];
    if (innerType) {
      return `z.array(${buildZodSchemaPart(innerType)})`;
    }
  }

  // Handle Object record syntax: Object.<string, number>
  const recordMatch = trimmedType.match(/^Object\.<([^,]+),\s*([^>]+)>/);
  if (recordMatch) {
    const keyType = buildZodSchemaPart(recordMatch[1]);
    const valueType = buildZodSchemaPart(recordMatch[2]);
    return `z.record(${keyType}, ${valueType})`;
  }

  // Handle Union types: string | number | null
  if (trimmedType.includes('|')) {
    const unionTypes = trimmedType.split('|').map(t => t.trim());
    const zodUnionTypes = unionTypes.map(t => buildZodSchemaPart(t));
    return `z.union([${zodUnionTypes.join(', ')}])`;
  }

  // Map primitive types or custom types
  return JSDOC_TO_ZOD_TYPE_MAP[trimmedType.toLowerCase()] ?? `z.custom<${trimmedType}>()`;
}

/**
 * Generates a Zod schema string for a single property (or parameter).
 * It combines the type conversion with modifiers like `.optional()` and `.describe()`.
 *
 * @param {{name: string, type: string, description: string, optional: boolean}} prop - The property object.
 * @param {string} indent - The indentation string to use for formatting.
 * @returns {string} A formatted Zod schema string for the property.
 */
function buildZodProperty(prop, indent) {
  let schemaString = `${indent}${prop.name}: ${buildZodSchemaPart(prop.type)}`;

  if (prop.optional) {
    schemaString += '.optional()';
  }

  if (prop.description) {
    const escapedDescription = prop.description.replace(/'/g, "\\'");
    schemaString += `.describe('${escapedDescription}')`;
  }

  return schemaString;
}

/**
 * Constructs a Zod object schema string from a list of properties.
 *
 * @param {Array<object>} properties - An array of property objects from a parsed JSDoc.
 * @param {string} [baseIndent='  '] - The base indentation for properties.
 * @returns {string} A formatted `z.object({...})` schema string.
 */
function buildZodObject(properties, baseIndent = '  ') {
  if (!Array.isArray(properties) || properties.length === 0) {
    return 'z.object({})';
  }

  const propStrings = properties.map(prop => buildZodProperty(prop, baseIndent));

  return `z.object({\n${propStrings.join(',\n')}\n})`;
}

/**
 * Generates the complete Zod schema code as a string from a single parsed entity.
 * This is the main entry point for the builder, deciding whether to generate a schema
 * for a function's parameters or for a `@typedef`.
 *
 * @param {object} parsedEntity - The structured object representing a parsed JSDoc block.
 * @param {string} parsedEntity.name - The name for the generated schema variable.
 * @param {Array<object>} [parsedEntity.params] - Parameters from `@param` tags.
 * @param {object} [parsedEntity.typedef] - Type definition from a `@typedef` tag.
 * @param {Array<object>} [parsedEntity.typedef.properties] - Properties from `@property` tags.
 * @returns {string|null} The complete, formatted Zod schema as a JavaScript code string, or null if no schema can be generated.
 */
export function buildZodSchema(parsedEntity) {
  if (!parsedEntity?.name) {
    return null;
  }

  const { name, params, typedef } = parsedEntity;
  let schemaDefinition;

  // Priority 1: @typedef with @property tags defines an object schema.
  if (typedef?.properties && typedef.properties.length > 0) {
    schemaDefinition = buildZodObject(typedef.properties);
  }
  // Priority 2: Function with @param tags defines an object schema for its arguments.
  else if (params && params.length > 0) {
    schemaDefinition = buildZodObject(params);
  }
  // Priority 3: A simple @typedef (e.g., @typedef {string|number} ID) defines a non-object schema.
  else if (typedef?.type) {
    schemaDefinition = buildZodSchemaPart(typedef.type);
  }
  // If none of the above, we can't generate a schema.
  else {
    return null;
  }

  const schemaName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Schema`;
  const exportStatement = `export const ${schemaName} = ${schemaDefinition};`;

  return `// Generated from ${name}\n${exportStatement}`;
}

/**
 * Generates a complete file content string containing all Zod schemas from multiple parsed entities.
 * It includes a header with an import for Zod.
 *
 * @param {Array<object>} parsedEntities - An array of parsed JSDoc entity objects.
 * @returns {string} A string representing the full content of a JavaScript file.
 */
export function generateZodSchemaFile(parsedEntities) {
  if (!Array.isArray(parsedEntities) || parsedEntities.length === 0) {
    return '';
  }

  const schemaStrings = parsedEntities
    .map(entity => buildZodSchema(entity))
    .filter(Boolean); // Filter out any null results

  if (schemaStrings.length === 0) {
    return '';
  }

  const header = `/**
 * This file was generated by jsdoc-to-zod.
 * Do not make changes to this file directly.
 */

import { z } from 'zod';

`;

  return header + schemaStrings.join('\n\n') + '\n';
}