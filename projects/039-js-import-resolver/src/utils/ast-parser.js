/**
 * @file src/utils/ast-parser.js
 * @description A lightweight parser to extract ES module import and export statements from JavaScript code.
 * This implementation uses regular expressions for performance and to avoid heavy dependencies like a full AST parser (e.g., Acorn, Babel).
 * It's designed to be fast and sufficient for the specific task of finding module specifiers.
 */

/**
 * A regular expression to capture ES module import statements.
 * It handles various forms like:
 * - import defaultExport from 'module';
 * - import { namedExport } from 'module';
 * - import { named as alias } from 'module';
 * - import * as name from 'module';
 * - import 'module'; (for side effects)
 * - import type { T } from 'module'; (captures but resolver will ignore if not found)
 *
 * It correctly handles single and double quotes for the module specifier.
 * It's designed to be resilient to comments and complex formatting.
 *
 * Breakdown:
 * - `^`: Start of a line (with `m` flag).
 * - `\s*`: Optional leading whitespace.
 * - `import`: The literal `import` keyword.
 * - `(?:\s+type)?`: Optionally match ` type` for TypeScript/Flow syntax.
 * - `\s+`: At least one whitespace character.
 * - `(?:`...`)?`: An optional non-capturing group for the imported bindings (e.g., `* as name`, `{ foo }`).
 * - `(?:'([^']+)'|"([^"]+)")`: A non-capturing group that matches either a single-quoted or double-quoted string.
 *   - `'([^']+)'`: Captures content inside single quotes.
 *   - `"([^"]+)"`: Captures content inside double quotes.
 * - `\s*`: Optional trailing whitespace.
 * - `[;]?`: An optional semicolon at the end.
 * - `\s*`: Optional whitespace before a potential newline.
 * - `$`: End of the line (with `m` flag).
 *
 * Capturing Groups:
 * 1. The module specifier from a single-quoted string.
 * 2. The module specifier from a double-quoted string.
 */
const IMPORT_REGEX = /^\s*import(?:\s+type)?\s+(?:.+?\s+from\s+)?(?:'([^']+)'|"([^"]+)").*$/gm;

/**
 * A regular expression to capture ES module export statements with a source.
 * It handles forms like:
 * - export { name1, name2 } from 'module';
 * - export * from 'module';
 * - export * as ns from 'module';
 *
 * It does NOT match exports without a source (e.g., `export const a = 1;`).
 *
 * Breakdown:
 * - `^`: Start of a line (with `m` flag).
 * - `\s*`: Optional leading whitespace.
 * - `export`: The literal `export` keyword.
 * - `\s+`: At least one whitespace character.
 * - `(?:\{.*\}|\*|\* as \w+)\s+from`: Matches the export list (`{...}`, `*`, `* as ns`) followed by `from`.
 * - `\s+`: Whitespace after `from`.
 * - `(?:'([^']+)'|"([^"]+)")`: Captures the module specifier in single or double quotes.
 * - `\s*`: Optional trailing whitespace.
 * - `[;]?`: An optional semicolon.
 * - `\s*`: Optional whitespace before a potential newline.
 * - `$`: End of the line (with `m` flag).
 *
 * Capturing Groups:
 * 1. The module specifier from a single-quoted string.
 * 2. The module specifier from a double-quoted string.
 */
const EXPORT_REGEX = /^\s*export\s+(?:(?:\{.*\}|\*|\* as \w+)\s+from)\s+(?:'([^']+)'|"([^"]+)").*$/gm;

/**
 * A regular expression to capture dynamic `import()` expressions.
 * It's intentionally simple to avoid parsing complex, dynamically generated specifiers.
 * It only captures string literals inside `import()`.
 *
 * Breakdown:
 * - `import\s*\(`: Matches `import(`.
 * - `\s*`: Optional whitespace.
 * - `(?:'([^']+)'|"([^"]+)")`: Captures the module specifier in single or double quotes.
 * - `\s*`: Optional whitespace.
 * - `\)`: Matches the closing parenthesis.
 *
 * Capturing Groups:
 * 1. The module specifier from a single-quoted string.
 * 2. The module specifier from a double-quoted string.
 */
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*(?:'([^']+)'|"([^"]+)").*?\)/g;

/**
 * Extracts module specifiers from import and export statements in a given code string.
 * This function uses regular expressions for performance, avoiding a full AST parse.
 *
 * @param {string} code - The JavaScript code content to parse.
 * @returns {Set<string>} A Set of unique module specifiers found in the code.
 *                         Returns an empty set if the code is empty or no imports/exports are found.
 */
function extractModuleSpecifiers(code) {
  if (!code || typeof code !== 'string') {
    return new Set();
  }

  const specifiers = new Set();
  const regexes = [IMPORT_REGEX, EXPORT_REGEX, DYNAMIC_IMPORT_REGEX];

  for (const regex of regexes) {
    // Reset regex state for each new execution on the same string
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(code)) !== null) {
      // The specifier is in capture group 1 (single quotes) or 2 (double quotes)
      const specifier = match[1] || match[2];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return specifiers;
}

/**
 * Parses JavaScript code to find all import and export declarations.
 *
 * @param {string} code - The source code of a JavaScript file.
 * @returns {{specifiers: Set<string>}} An object containing a set of unique module specifiers.
 * @throws {Error} If the provided code is not a string.
 */
export function parseImportsAndExports(code) {
  if (typeof code !== 'string') {
    throw new Error('Invalid input: The "code" argument must be a string.');
  }

  const specifiers = extractModuleSpecifiers(code);

  return { specifiers };
}