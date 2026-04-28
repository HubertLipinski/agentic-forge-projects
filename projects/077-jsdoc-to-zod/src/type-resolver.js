/**
 * @fileoverview Manages a map of known types from @typedef declarations to
 * prevent re-processing and handle type lookups during schema generation.
 * This class acts as a central registry for custom types within a project.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * @typedef {import('./parser/doctrine-parser.js').ParsedJSDoc} ParsedJSDoc
 */

/**
 * A utility class to register and resolve custom types defined with `@typedef`.
 *
 * It maintains a map of type names to their parsed JSDoc representations and
 * generated Zod schema variable names. This allows the generator to correctly
 * reference custom types, even when they are defined in different files or
 * in a different order.
 */
export default class TypeResolver {
	/**
	 * A map where keys are custom type names (from `@typedef`) and values are
	 * the fully parsed JSDoc objects.
	 * @private
	 * @type {Map<string, ParsedJSDoc>}
	 */
	#typeMap = new Map();

	/**
	 * A map where keys are custom type names and values are the corresponding
	 * generated Zod schema variable names. This is used for referencing
	 * already-generated schemas.
	 * @private
	 * @type {Map<string, string>}
	 */
	#schemaNameMap = new Map();

	/**
	 * Registers a new custom type, typically found from a `@typedef` tag.
	 *
	 * @param {string} typeName - The name of the custom type (e.g., "MyUser").
	 * @param {ParsedJSDoc} parsedJSDoc - The parsed JSDoc object for this type.
	 * @throws {Error} If the typeName is not a non-empty string or if parsedJSDoc is invalid.
	 */
	register(typeName, parsedJSDoc) {
		if (typeof typeName !== 'string' || typeName.trim() === '') {
			throw new Error('Type name must be a non-empty string.');
		}
		if (!parsedJSDoc || typeof parsedJSDoc !== 'object') {
			throw new Error(`Invalid parsedJSDoc provided for type "${typeName}".`);
		}

		if (this.#typeMap.has(typeName)) {
			// Warn about re-definition but allow it. The last one wins.
			// This can happen if multiple files define the same type, which is a user error.
			console.warn(`[jsdoc-to-zod] Warning: Type "${typeName}" is being redefined.`);
		}

		this.#typeMap.set(typeName, parsedJSDoc);

		// The schema variable name is typically the same as the type name,
		// but this indirection allows for future flexibility (e.g., name mangling).
		this.#schemaNameMap.set(typeName, typeName);
	}

	/**
	 * Checks if a given type name has been registered.
	 *
	 * @param {string} typeName - The name of the type to check.
	 * @returns {boolean} `true` if the type is registered, `false` otherwise.
	 */
	has(typeName) {
		return this.#typeMap.has(typeName);
	}

	/**
	 * Retrieves the parsed JSDoc object for a given type name.
	 *
	 * @param {string} typeName - The name of the type to retrieve.
	 * @returns {ParsedJSDoc | undefined} The parsed JSDoc object, or `undefined` if not found.
	 */
	get(typeName) {
		return this.#typeMap.get(typeName);
	}

	/**
	 * Retrieves the variable name of the generated Zod schema for a given type.
	 * This is used to reference the schema in generated code.
	 *
	 * @param {string} typeName - The name of the custom type.
	 * @returns {string | undefined} The schema variable name, or `undefined` if not found.
	 */
	getSchemaName(typeName) {
		return this.#schemaNameMap.get(typeName);
	}

	/**
	 * Returns an array of all registered type names.
	 *
	 * @returns {string[]} An array of all type names.
	 */
	getAllTypeNames() {
		return Array.from(this.#typeMap.keys());
	}

	/**
	 * Returns an array of all registered `ParsedJSDoc` objects.
	 * This is useful for iterating over all known types to generate their schemas.
	 *
	 * @returns {ParsedJSDoc[]} An array of all parsed JSDoc objects for registered types.
	 */
	getAllTypes() {
		return Array.from(this.#typeMap.values());
	}

	/**
	 * Clears all registered types from the resolver.
	 * Useful for resetting state between separate generation runs.
	 */
	clear() {
		this.#typeMap.clear();
		this.#schemaNameMap.clear();
	}
}