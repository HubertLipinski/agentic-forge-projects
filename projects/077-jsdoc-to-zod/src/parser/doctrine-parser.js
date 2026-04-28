/**
 * @fileoverview Parses a JSDoc comment block string using Doctrine and transforms it
 * into a structured, intermediate representation (IR). This IR is designed to be
 * easily consumed by the Zod schema generator.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

import doctrine from 'doctrine';
import { JSDOC_TO_ZOD_TYPE_MAP } from '../constants.js';

/**
 * @typedef {object} ParsedProperty
 * @property {string} name - The name of the property.
 * @property {string} type - The normalized type of the property (e.g., 'string', 'number', 'MyCustomType').
 * @property {string} [description] - The description of the property.
 * @property {boolean} isOptional - Whether the property is optional.
 * @property {string|number|boolean|null} [defaultValue] - The default value, if specified.
 * @property {boolean} isArray - Whether the property is an array.
 * @property {boolean} isUnion - Whether the property is a union of types.
 * @property {Array<string>} [unionTypes] - An array of types if it's a union.
 * @property {Array<ParsedProperty>} [properties] - For nested objects, the properties of the object.
 */

/**
 * @typedef {object} ParsedJSDoc
 * @property {string} [name] - The name of the type or function.
 * @property {string} [description] - The main description from the JSDoc block.
 * @property {string} [type] - The primary type, used for simple `@typedef` or `@returns`.
 * @property {Array<ParsedProperty>} [params] - Parameters for a function.
 * @property {ParsedProperty} [returns] - The return value of a function.
 * @property {Array<ParsedProperty>} [properties] - Properties for an object type defined with `@typedef`.
 * @property {boolean} isTypeDef - Indicates if this was parsed from a `@typedef`.
 * @property {boolean} isFunction - Indicates if this was parsed from a function's JSDoc.
 */

/**
 * Parses a Doctrine type object into a simplified, consistent format.
 * This is the core of the type normalization logic.
 *
 * @param {doctrine.Type} doctrineType - The type object from Doctrine's parser.
 * @returns {{
 *   type: string,
 *   isArray: boolean,
 *   isUnion: boolean,
 *   unionTypes?: string[],
 *   properties?: ParsedProperty[]
 * }} - A structured representation of the type.
 * @private
 */
function _parseDoctrineType(doctrineType) {
	if (!doctrineType) {
		return { type: 'any', isArray: false, isUnion: false };
	}

	switch (doctrineType.type) {
		case 'NameExpression':
			// A simple type like `string` or `MyType`.
			return {
				type: JSDOC_TO_ZOD_TYPE_MAP[doctrineType.name.toLowerCase()] ?? doctrineType.name,
				isArray: false,
				isUnion: false,
			};

		case 'UnionType':
			// A union like `string|number`.
			const unionTypes = doctrineType.elements.map(element => _parseDoctrineType(element).type);
			return {
				type: 'union',
				isArray: false,
				isUnion: true,
				unionTypes: [...new Set(unionTypes)], // Deduplicate types
			};

		case 'TypeApplication':
			// An array like `Array<string>` or `string[]`.
			if (doctrineType.expression.name?.toLowerCase() === 'array' && doctrineType.applications.length === 1) {
				// Handles `Array<string>` or `Array<string|number>`.
				const innerType = _parseDoctrineType(doctrineType.applications[0]);
				return { ...innerType, isArray: true };
			}
			// Fallback for other generic types we might not fully support.
			return { type: 'any', isArray: false, isUnion: false };

		case 'AllLiteral': // *
		case 'NullableLiteral': // ?
		case 'NotNullableLiteral': // !
		case 'VoidLiteral': // void
		case 'UndefinedLiteral': // undefined
			return { type: 'any', isArray: false, isUnion: false };

		case 'RecordType': {
			// An object literal like `{name: string, age: number}`.
			const properties = doctrineType.fields.map(field => {
				const propTypeInfo = _parseDoctrineType(field.value);
				return {
					name: field.key,
					description: undefined, // Not available in this context
					isOptional: false, // Not available in this context
					...propTypeInfo,
				};
			});
			return { type: 'object', isArray: false, isUnion: false, properties };
		}

		default:
			// Fallback for any other unhandled Doctrine type.
			return { type: 'any', isArray: false, isUnion: false };
	}
}

/**
 * Parses a single JSDoc tag (like `@param` or `@property`) into a `ParsedProperty`.
 *
 * @param {doctrine.Tag} tag - A tag object from Doctrine.
 * @returns {ParsedProperty | null} A structured property object, or null if the tag is invalid.
 * @private
 */
function _parseTag(tag) {
	if (!tag.name || !tag.type) {
		return null;
	}

	const typeInfo = _parseDoctrineType(tag.type);

	// Doctrine provides `optional: true` for `[name]` but not for `name=value`.
	const isOptional = tag.optional === true || typeof tag.default !== 'undefined';

	return {
		name: tag.name,
		description: tag.description ?? undefined,
		isOptional,
		defaultValue: tag.default ?? undefined,
		...typeInfo,
	};
}

/**
 * Parses a raw JSDoc comment string into a structured intermediate representation.
 *
 * @param {string} jsdocComment - The raw JSDoc comment string, including `/**` and `*/`.
 * @returns {ParsedJSDoc | null} A structured object representing the JSDoc, or null if parsing fails or the comment is empty.
 */
export function parseJSDoc(jsdocComment) {
	if (!jsdocComment || typeof jsdocComment !== 'string') {
		return null;
	}

	try {
		const ast = doctrine.parse(jsdocComment, {
			unwrap: true, // Removes the leading `/**` and trailing `*/`
			sloppy: true, // Allows for some syntax errors
			tags: null, // Parse all tags
		});

		if (ast.tags.length === 0) {
			return null; // No tags to process.
		}

		const result = {
			description: ast.description || undefined,
			params: [],
			properties: [],
			isTypeDef: false,
			isFunction: false,
		};

		for (const tag of ast.tags) {
			switch (tag.title) {
				case 'param': {
					const parsedParam = _parseTag(tag);
					if (parsedParam) {
						result.params.push(parsedParam);
						result.isFunction = true;
					}
					break;
				}
				case 'property': {
					const parsedProp = _parseTag(tag);
					if (parsedProp) {
						result.properties.push(parsedProp);
					}
					break;
				}
				case 'returns':
				case 'return': {
					if (tag.type) {
						const typeInfo = _parseDoctrineType(tag.type);
						result.returns = {
							name: 'return',
							description: tag.description ?? undefined,
							isOptional: false, // Return is never optional in this context
							...typeInfo,
						};
						result.isFunction = true;
					}
					break;
				}
				case 'typedef': {
					result.isTypeDef = true;
					if (tag.type && tag.name) {
						result.name = tag.name;
						const typeInfo = _parseDoctrineType(tag.type);

						if (typeInfo.type === 'object' && typeInfo.properties) {
							// For `@typedef {object} MyType`, properties are defined with `@property`.
							// We merge them here.
							const existingProps = new Set(result.properties.map(p => p.name));
							for (const prop of typeInfo.properties) {
								if (!existingProps.has(prop.name)) {
									result.properties.push(prop);
								}
							}
						} else {
							// For simple typedefs like `@typedef {string|number} MyUnion`.
							result.type = typeInfo.type;
							if (typeInfo.isUnion) {
								result.unionTypes = typeInfo.unionTypes;
							}
						}
					}
					break;
				}
				case 'type': {
					// Handle `@type` tag which can define the type of a variable.
					// Often used with `@const`.
					if (tag.type) {
						const typeInfo = _parseDoctrineType(tag.type);
						result.type = typeInfo.type;
						if (typeInfo.isUnion) {
							result.unionTypes = typeInfo.unionTypes;
						}
						if (typeInfo.type === 'object' && typeInfo.properties) {
							result.properties.push(...typeInfo.properties);
						}
					}
					break;
				}
			}
		}

		// If it's a @typedef with properties but no explicit `{object}` type,
		// infer it's an object.
		if (result.isTypeDef && result.properties.length > 0 && !result.type) {
			result.type = 'object';
		}

		// Clean up empty arrays
		if (result.params.length === 0) delete result.params;
		if (result.properties.length === 0) delete result.properties;

		// If after all parsing, there's nothing useful, return null.
		if (!result.isTypeDef && !result.isFunction && !result.type && !result.properties) {
			return null;
		}

		return result;
	} catch (error) {
		// Log the error but don't crash the process.
		// A malformed JSDoc shouldn't halt the entire CLI execution.
		console.error(`[jsdoc-to-zod] Error parsing JSDoc comment: ${error.message}`);
		return null;
	}
}