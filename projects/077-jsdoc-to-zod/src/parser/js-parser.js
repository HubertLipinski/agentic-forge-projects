/**
 * @fileoverview Uses Acorn and Acorn Walk to parse JavaScript files, find JSDoc blocks,
 * and associate them with code constructs like functions and object literals.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

import { parse } from 'acorn';
import { simple as walkSimple } from 'acorn-walk';
import {
	getLeadingJSDocComment,
	getFunctionName,
	getVariableDeclaratorName,
} from '../utils/ast-utils.js';
import { parseJSDoc } from './doctrine-parser.js';

/**
 * @typedef {import('./doctrine-parser.js').ParsedJSDoc} ParsedJSDoc
 */

/**
 * Represents a JSDoc block found in the source code, associated with a
 * specific AST node and its location.
 *
 * @typedef {object} FoundJSDoc
 * @property {string} file - The path to the file where the JSDoc was found.
 * @property {string} name - The name of the associated code construct (e.g., function name, typedef name).
 * @property {ParsedJSDoc} parsed - The structured intermediate representation of the JSDoc.
 * @property {import('acorn').Node} node - The AST node associated with the JSDoc.
 * @property {number} start - The start character offset of the JSDoc comment in the source.
 * @property {number} end - The end character offset of the JSDoc comment in the source.
 */

/**
 * Parses JavaScript source code to find JSDoc comments and associates them
 * with the relevant AST nodes (functions, variable declarations, etc.).
 *
 * @param {string} sourceCode - The JavaScript source code to parse.
 * @param {string} [filePath='<anonymous>'] - The path of the file being parsed, for context in results.
 * @returns {Array<FoundJSDoc>} An array of found JSDoc blocks with their parsed content and context.
 * @throws {Error} If Acorn fails to parse the source code.
 */
export function parseJavaScript(sourceCode, filePath = '<anonymous>') {
	if (typeof sourceCode !== 'string') {
		throw new TypeError('sourceCode must be a string.');
	}

	const foundDocs = [];

	try {
		const ast = parse(sourceCode, {
			ecmaVersion: 'latest',
			sourceType: 'module',
			locations: true,
			onComment: [], // Required to collect comments
		});

		// Acorn's `onComment` populates an array. Let's call it `comments`.
		const comments = ast.comments;
		if (!comments || comments.length === 0) {
			return []; // No comments, no JSDoc to process.
		}

		// Walk the AST to find nodes that might have JSDoc comments.
		// We use `walkSimple` for a basic, state-less traversal.
		walkSimple(ast, {
			/**
			 * Catches `function myFunction() {}` and `async function myFunction() {}`.
			 * @param {import('acorn').FunctionDeclaration} node
			 */
			FunctionDeclaration(node) {
				const comment = getLeadingJSDocComment(node, comments);
				if (!comment) return;

				const parsed = parseJSDoc(`/*${comment.value}*/`);
				if (!parsed) return;

				const name = getFunctionName(node);
				if (!name) return; // Anonymous function declarations are not valid JS.

				foundDocs.push({
					file: filePath,
					name,
					parsed,
					node,
					start: comment.start,
					end: comment.end,
				});
			},

			/**
			 * Catches `const myVar = ...`, `let x = ...`, etc. This is crucial for
			 * `@typedef` and function expressions assigned to variables.
			 * @param {import('acorn').VariableDeclaration} node
			 */
			VariableDeclaration(node) {
				const comment = getLeadingJSDocComment(node, comments);
				if (!comment) return;

				const parsed = parseJSDoc(`/*${comment.value}*/`);
				if (!parsed) return;

				// Try to get the name from the variable declarator, e.g., `MyType` in `const MyType = {}`.
				let name = getVariableDeclaratorName(node);

				// If it's a function expression, we might get a better name.
				// e.g., `const myFunc = () => {}`
				const declarator = node.declarations[0];
				if (
					declarator?.init?.type === 'ArrowFunctionExpression' ||
					declarator?.init?.type === 'FunctionExpression'
				) {
					// The name from the variable is usually what we want.
					// `getFunctionName` would also work here but this is more direct.
					name = name ?? getFunctionName(declarator.init);
				}

				// A `@typedef` or `@type` without a variable name is not useful.
				if (!name) return;

				// If the parsed JSDoc itself has a name (from `@typedef MyTypeName`), prefer it.
				const finalName = parsed.name ?? name;

				// Ensure the parsed doc has a name property for consistency.
				if (!parsed.name) {
					parsed.name = finalName;
				}

				foundDocs.push({
					file: filePath,
					name: finalName,
					parsed,
					node,
					start: comment.start,
					end: comment.end,
				});
			},
		});

		// Deduplicate results. It's possible for the walker to visit nodes in a way
		// that might produce overlapping results, though unlikely with this setup.
		// The key is the start offset of the comment.
		const uniqueDocs = new Map();
		for (const doc of foundDocs) {
			if (!uniqueDocs.has(doc.start)) {
				uniqueDocs.set(doc.start, doc);
			}
		}

		return Array.from(uniqueDocs.values());
	} catch (error) {
		// Provide context for parsing errors.
		if (error instanceof SyntaxError) {
			console.error(`[jsdoc-to-zod] Failed to parse JavaScript in ${filePath}: ${error.message}`);
			// Re-throw a more specific error to be handled by the caller.
			throw new Error(`Acorn parsing error in ${filePath} at line ${error.loc?.line}, column ${error.loc?.column}.`);
		}
		// Rethrow other unexpected errors.
		throw error;
	}
}