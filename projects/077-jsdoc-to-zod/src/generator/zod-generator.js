/**
 * @fileoverview The core logic that takes the intermediate representation (IR)
 * from the parsers and generates the final Zod schema code as a string.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

import { SchemaBuilder } from '../utils/schema-builder.js';
import { JSDOC_TO_ZOD_TYPE_MAP } from '../constants.js';

/**
 * @typedef {import('../parser/doctrine-parser.js').ParsedJSDoc} ParsedJSDoc
 * @typedef {import('../parser/doctrine-parser.js').ParsedProperty} ParsedProperty
 * @typedef {import('../type-resolver.js').default} TypeResolver
 */

/**
 * Generates a Zod schema string for a single property or type.
 * This is a recursive function that builds up complex schemas.
 *
 * @param {ParsedProperty} property - The parsed property information.
 * @param {TypeResolver} typeResolver - The resolver to look up custom types.
 * @returns {SchemaBuilder} A SchemaBuilder instance containing the Zod schema string for the property.
 * @private
 */
function _generateSchemaForProperty(property, typeResolver) {
	const builder = new SchemaBuilder();

	if (property.isUnion && property.unionTypes) {
		// Handle union types like `string | number`
		const unionSchemas = property.unionTypes.map(unionType => {
			const tempProp = { ...property, type: unionType, isUnion: false, unionTypes: undefined };
			return _generateSchemaForProperty(tempProp, typeResolver).toString();
		});

		// Filter out any empty/invalid schemas and join them for z.union()
		const validSchemas = unionSchemas.filter(s => s.length > 0);
		if (validSchemas.length > 1) {
			builder.add('z.union([');
			builder.indent();
			validSchemas.forEach(schema => builder.add(`${schema},`));
			builder.unindent();
			builder.add('])');
		} else if (validSchemas.length === 1) {
			// If only one type is valid after resolution, just use that one.
			builder.add(validSchemas[0]);
		} else {
			// Fallback if no types in the union could be resolved.
			builder.add('z.any()');
		}
	} else if (property.type === 'object' && property.properties) {
		// Handle nested object literals like `{name: string, age: number}`
		builder.add('z.object({');
		builder.indent();
		for (const prop of property.properties) {
			const propSchema = _generateSchemaForProperty(prop, typeResolver);
			builder.add(`${prop.name}:`).append(propSchema).add(',');
		}
		builder.unindent();
		builder.add('})');
	} else {
		// Handle primitive types, custom types, and arrays of them.
		const zodType = JSDOC_TO_ZOD_TYPE_MAP[property.type?.toLowerCase()] ?? null;

		if (zodType) {
			// It's a known primitive type.
			builder.add(`z.${zodType}()`);
		} else if (typeResolver.has(property.type)) {
			// It's a custom type defined via @typedef that has been resolved.
			// We reference it by its generated variable name.
			builder.add(typeResolver.getSchemaName(property.type));
		} else {
			// Fallback for unknown types.
			console.warn(`[jsdoc-to-zod] Unknown type "${property.type}". Defaulting to z.any().`);
			builder.add('z.any()');
		}
	}

	// Apply modifiers like .array(), .optional(), .default()
	if (property.isArray) {
		builder.add('.array()');
	}
	if (property.isOptional) {
		builder.add('.optional()');
	}
	if (property.defaultValue !== undefined && property.defaultValue !== null) {
		// Safely stringify the default value.
		const defaultValueString = JSON.stringify(property.defaultValue);
		builder.add(`.default(${defaultValueString})`);
	}

	return builder;
}

/**
 * Generates a Zod schema string from a parsed JSDoc object.
 *
 * This function acts as the main entry point for the generator, dispatching to
 * helper functions based on the type of JSDoc entity (e.g., a function,
 * an object typedef).
 *
 * @param {ParsedJSDoc} parsedJSDoc - The intermediate representation of a JSDoc block.
 * @param {TypeResolver} typeResolver - An instance of TypeResolver to manage and look up custom types.
 * @returns {string} The generated Zod schema code as a string, or an empty string if no schema can be generated.
 * @throws {Error} If `parsedJSDoc` or `typeResolver` is invalid.
 */
export function generateZodSchema(parsedJSDoc, typeResolver) {
	if (!parsedJSDoc || typeof parsedJSDoc !== 'object') {
		throw new Error('Invalid parsedJSDoc object provided.');
	}
	if (!typeResolver || typeof typeResolver.has !== 'function') {
		throw new Error('Invalid TypeResolver instance provided.');
	}

	const builder = new SchemaBuilder();
	const schemaName = parsedJSDoc.name ?? 'unnamedSchema';

	if (parsedJSDoc.isTypeDef) {
		// Handle `@typedef`
		if (parsedJSDoc.type === 'object' && parsedJSDoc.properties) {
			// e.g., @typedef {object} MyObject
			builder.add(`export const ${schemaName} = z.object({`);
			builder.indent();
			for (const prop of parsedJSDoc.properties) {
				const propSchema = _generateSchemaForProperty(prop, typeResolver);
				builder.add(`${prop.name}:`).append(propSchema).add(',');
			}
			builder.unindent();
			builder.add('});');
		} else if (parsedJSDoc.isUnion) {
			// e.g., @typedef {string | number} MyUnion
			const unionSchema = _generateSchemaForProperty({ ...parsedJSDoc, name: schemaName }, typeResolver);
			builder.add(`export const ${schemaName} =`).append(unionSchema).add(';');
		} else if (parsedJSDoc.type) {
			// e.g., @typedef {string[]} StringArray
			const typeSchema = _generateSchemaForProperty({ ...parsedJSDoc, name: schemaName }, typeResolver);
			builder.add(`export const ${schemaName} =`).append(typeSchema).add(';');
		}
	} else if (parsedJSDoc.isFunction) {
		// Handle function JSDoc with @param and @returns
		if (parsedJSDoc.params && parsedJSDoc.params.length > 0) {
			builder.add(`export const ${schemaName}Params = z.object({`);
			builder.indent();
			for (const param of parsedJSDoc.params) {
				const paramSchema = _generateSchemaForProperty(param, typeResolver);
				builder.add(`${param.name}:`).append(paramSchema).add(',');
			}
			builder.unindent();
			builder.add('});');
		}

		if (parsedJSDoc.returns && parsedJSDoc.returns.type !== 'void') {
			if (!builder.isEmpty()) {
				builder.addEmptyLine();
			}
			const returnSchema = _generateSchemaForProperty(parsedJSDoc.returns, typeResolver);
			builder.add(`export const ${schemaName}Return =`).append(returnSchema).add(';');
		}
	} else if (parsedJSDoc.properties) {
		// Handle a simple object definition via `@type {object}` on a variable
		builder.add(`export const ${schemaName} = z.object({`);
		builder.indent();
		for (const prop of parsedJSDoc.properties) {
			const propSchema = _generateSchemaForProperty(prop, typeResolver);
			builder.add(`${prop.name}:`).append(propSchema).add(',');
		}
		builder.unindent();
		builder.add('});');
	}

	return builder.toString();
}

/**
 * Generates the complete file content, including necessary imports.
 *
 * @param {Array<{name: string, schema: string}>} schemas - An array of objects, each containing a schema name and its generated code string.
 * @returns {string} The final, formatted file content with a Zod import and all generated schemas.
 */
export function generateZodFileContent(schemas) {
	if (!Array.isArray(schemas) || schemas.length === 0) {
		return '';
	}

	const fileBuilder = new SchemaBuilder();

	// Add file header and import statement
	fileBuilder.add("/**");
	fileBuilder.add(" * This file was auto-generated by jsdoc-to-zod.");
	fileBuilder.add(" * Do not make direct changes to this file.");
	fileBuilder.add(" */");
	fileBuilder.addEmptyLine();
	fileBuilder.add("import { z } from 'zod';");
	fileBuilder.addEmptyLine();

	// Add each generated schema to the file
	schemas.forEach(({ schema }, index) => {
		if (schema.trim()) {
			fileBuilder.add(schema);
			// Add a blank line between schemas for readability
			if (index < schemas.length - 1) {
				fileBuilder.addEmptyLine();
			}
		}
	});

	return fileBuilder.toString();
}