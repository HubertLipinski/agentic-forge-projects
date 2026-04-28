/**
 * @fileoverview Defines mappings from JSDoc primitive types to Zod schema method names.
 * This constant object is used to translate type names found in JSDoc comments
 * into the corresponding Zod constructor methods.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * A mapping from lowercase JSDoc primitive type names to their corresponding
 * Zod schema method names. This enables the generator to create the correct
 * Zod type from a parsed JSDoc tag.
 *
 * Note:
 * - `any` and `*` are mapped to `any` in Zod, providing a flexible escape hatch.
 * - `Object` (with a capital 'O') is mapped to `object`, which in the generator's
 *   context usually implies a `z.object({})` with properties defined elsewhere.
 * - `Date` is included for common usage, mapping to `z.date()`.
 *
 * Custom types (e.g., `MyType`) are not included here; they are resolved
 * separately by the `TypeResolver`.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const JSDOC_TO_ZOD_TYPE_MAP = Object.freeze({
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	bool: 'boolean', // Alias for boolean
	date: 'date',
	any: 'any',
	'*': 'any', // JSDoc syntax for any type
	object: 'object', // Note: The generator handles `z.object({...})` logic separately.
	null: 'null',
	undefined: 'undefined',
});

/**
 * A set of JSDoc types that are considered "primitive" by the generator.
 * This helps differentiate them from custom object types (`@typedef`) that
 * require deeper processing.
 *
 * @type {Readonly<Set<string>>}
 */
export const PRIMITIVE_TYPES = new Set(Object.keys(JSDOC_TO_ZOD_TYPE_MAP));