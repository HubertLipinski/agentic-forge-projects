/**
 * @fileoverview A utility class for programmatically building Zod schema
 * code strings with correct indentation and formatting.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * Represents a single line of code being built.
 * It's a tuple where the first element is the indentation level (number)
 * and the second is the code string for that line.
 * @typedef {[number, string]} CodeLine
 */

/**
 * A utility class to construct code strings with proper indentation.
 * It simplifies the process of generating multi-line, nested code blocks
 * like Zod schemas.
 *
 * @example
 * const builder = new SchemaBuilder();
 * builder.add('z.object({');
 * builder.indent();
 * builder.add('name: z.string(),');
 * builder.unindent();
 * builder.add('})');
 * console.log(builder.toString());
 * // Output:
 * // z.object({
 * //   name: z.string(),
 * // })
 */
export class SchemaBuilder {
	/**
	 * The character(s) to use for a single indentation level.
	 * @private
	 * @readonly
	 * @type {string}
	 */
	#indentationChar = '  '; // Two spaces for indentation

	/**
	 * The current indentation level.
	 * @private
	 * @type {number}
	 */
	#currentIndentLevel = 0;

	/**
	 * An array of `CodeLine` tuples representing the code being built.
	 * @private
	 * @type {Array<CodeLine>}
	 */
	#lines = [];

	/**
	 * Creates an instance of SchemaBuilder.
	 * @param {number} [initialIndentLevel=0] - The starting indentation level.
	 */
	constructor(initialIndentLevel = 0) {
		if (!Number.isInteger(initialIndentLevel) || initialIndentLevel < 0) {
			throw new Error('Initial indentation level must be a non-negative integer.');
		}
		this.#currentIndentLevel = initialIndentLevel;
	}

	/**
	 * Adds a line of code at the current indentation level.
	 * If the input is a multi-line string, each line is added separately.
	 *
	 * @param {string} line - The line of code to add.
	 * @returns {this} The SchemaBuilder instance for chaining.
	 */
	add(line) {
		const linesToAdd = String(line).split('\n');
		for (const singleLine of linesToAdd) {
			this.#lines.push([this.#currentIndentLevel, singleLine]);
		}
		return this;
	}

	/**
	 * Adds a blank line, ignoring indentation.
	 * @returns {this} The SchemaBuilder instance for chaining.
	 */
	addEmptyLine() {
		this.#lines.push([0, '']);
		return this;
	}

	/**
	 * Increases the indentation level for subsequent lines.
	 * @returns {this} The SchemaBuilder instance for chaining.
	 */
	indent() {
		this.#currentIndentLevel++;
		return this;
	}

	/**
	 * Decreases the indentation level for subsequent lines.
	 * Prevents the level from going below zero.
	 * @returns {this} The SchemaBuilder instance for chaining.
	 */
	unindent() {
		this.#currentIndentLevel = Math.max(0, this.#currentIndentLevel - 1);
		return this;
	}

	/**
	 * Appends another SchemaBuilder's content to this one.
	 * The appended content's indentation is adjusted relative to the current
	 * builder's indentation level.
	 *
	 * @param {SchemaBuilder} otherBuilder - The builder to append.
	 * @returns {this} The SchemaBuilder instance for chaining.
	 */
	append(otherBuilder) {
		if (!(otherBuilder instanceof SchemaBuilder)) {
			throw new TypeError('Argument must be an instance of SchemaBuilder.');
		}

		const otherLines = otherBuilder.getLines();
		for (const [level, line] of otherLines) {
			// Add the current indentation level to the appended line's level
			this.#lines.push([this.#currentIndentLevel + level, line]);
		}
		return this;
	}

	/**
	 * Checks if any lines have been added to the builder.
	 * @returns {boolean} `true` if the builder is empty, `false` otherwise.
	 */
	isEmpty() {
		return this.#lines.length === 0;
	}

	/**
	 * Retrieves the internal representation of the code lines.
	 * Useful for operations like `append`.
	 * @returns {Array<CodeLine>} A copy of the internal lines array.
	 */
	getLines() {
		// Return a structured clone to prevent external mutation
		return structuredClone(this.#lines);
	}

	/**
	 * Compiles the added lines into a single, formatted string.
	 *
	 * @returns {string} The final, indented code string.
	 */
	toString() {
		return this.#lines
			.map(([level, line]) => {
				if (line === '') {
					return ''; // Preserve empty lines without indentation
				}
				const indent = this.#indentationChar.repeat(level);
				return `${indent}${line}`;
			})
			.join('\n');
	}
}