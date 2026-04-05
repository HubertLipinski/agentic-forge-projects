/**
 * @file src/utils/schema-merger.js
 * @description Provides logic for merging two partial JSON schemas into one.
 * This module is central to handling arrays of JSON objects, allowing the tool
 * to create a comprehensive schema that accounts for variations across multiple
 * sample objects, such as optional properties and mixed-type fields.
 */

import { isObject } from './type-utils.js';

/**
 * Merges two JSON schema types.
 * If types are identical, it returns the single type.
 * If types are different, it returns a sorted array of unique types.
 * It also handles upgrading 'integer' to 'number' if both are present.
 *
 * @param {string|string[]} type1 - The type from the first schema.
 * @param {string|string[]} type2 - The type from the second schema.
 * @returns {string|string[]} The merged type.
 */
function mergeTypes(type1, type2) {
  const types = new Set([...[].concat(type1), ...[].concat(type2)]);

  // If 'number' and 'integer' are both present, 'integer' is redundant.
  if (types.has('number') && types.has('integer')) {
    types.delete('integer');
  }

  const uniqueTypes = Array.from(types).sort();

  return uniqueTypes.length === 1 ? uniqueTypes[0] : uniqueTypes;
}

/**
 * Recursively merges two JSON Schema objects. This is the core merging logic.
 *
 * @param {object} schema1 - The base schema to merge into. This object may be mutated.
 * @param {object} schema2 - The schema to merge from.
 * @returns {object} The merged schema (schema1).
 * @throws {Error} If either schema is not a valid object.
 */
function mergeSchemaObjects(schema1, schema2) {
  if (!isObject(schema1) || !isObject(schema2)) {
    throw new Error('Both schemas to be merged must be objects.');
  }

  // Merge types
  if (schema2.type) {
    schema1.type = mergeTypes(schema1.type, schema2.type);
  }

  // Merge object properties
  if (isObject(schema1.properties) && isObject(schema2.properties)) {
    for (const key in schema2.properties) {
      if (key in schema1.properties) {
        // Property exists in both, so recurse
        schema1.properties[key] = mergeSchemaObjects(
          schema1.properties[key],
          schema2.properties[key]
        );
      } else {
        // Property only exists in schema2, so add it to schema1
        schema1.properties[key] = schema2.properties[key];
      }
    }
  }

  // Merge array items
  if (isObject(schema1.items) && isObject(schema2.items)) {
    schema1.items = mergeSchemaObjects(schema1.items, schema2.items);
  }

  // Merge required properties. The new set of required properties is the
  // intersection of the previous sets. A property is only required if it
  // is present in ALL objects being merged.
  if (Array.isArray(schema1.required) && Array.isArray(schema2.required)) {
    const required2Set = new Set(schema2.required);
    schema1.required = schema1.required.filter((prop) => required2Set.has(prop));

    // If no common required properties remain, remove the 'required' keyword.
    if (schema1.required.length === 0) {
      delete schema1.required;
    }
  } else {
    // If one schema had 'required' and the other didn't, it means not all
    // properties are guaranteed to be present. Thus, we remove the constraint.
    delete schema1.required;
  }

  return schema1;
}

/**
 * Merges two JSON schemas, creating a deep copy to avoid mutating the original inputs.
 * This is the primary export of the module. It handles the initial cloning and
 * delegates the core logic to `mergeSchemaObjects`.
 *
 * @param {object} schema1 - The first JSON schema object.
 * @param {object} schema2 - The second JSON schema object.
 * @returns {object} A new, deeply merged JSON schema object.
 * @throws {Error} If inputs are not valid schema objects.
 */
export function mergeSchemas(schema1, schema2) {
  if (!isObject(schema1)) {
    throw new Error('The first argument (schema1) must be a valid schema object.');
  }
  if (!isObject(schema2)) {
    throw new Error('The second argument (schema2) must be a valid schema object.');
  }

  // Use structuredClone for a deep, safe copy, preventing mutation of originals.
  const clonedSchema1 = structuredClone(schema1);

  return mergeSchemaObjects(clonedSchema1, schema2);
}