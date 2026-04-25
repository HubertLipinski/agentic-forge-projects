/**
 * @fileoverview Builds commander.js command definitions from parsed JSDoc.
 *
 * This module is responsible for the core logic of translating the structured
 * information extracted from JSDoc comments into executable code snippets that
 * utilize the `commander` library. It determines how function parameters map to
 * CLI arguments and options (flags), and constructs the full command chain
 * for each function.
 *
 * @module src/core/command-builder
 */

/**
 * A set of JSDoc types that should be treated as boolean flags in the CLI.
 * These flags do not take a value (e.g., `--verbose`).
 * @type {Readonly<Set<string>>}
 */
const BOOLEAN_FLAG_TYPES = Object.freeze(new Set(['boolean']));

/**
 * A set of JSDoc types that require a value when used as an option.
 * These flags take a value (e.g., `--level <number>`).
 * @type {Readonly<Set<string>>}
 */
const VALUED_FLAG_TYPES = Object.freeze(new Set(['string', 'number']));

/**
 * Escapes a string for safe inclusion within a single-quoted JavaScript string.
 * This handles backslashes and single quotes.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Generates the name for a CLI option (flag) from a parameter name.
 * Converts camelCase to kebab-case (e.g., `myVar` -> `--my-var`).
 *
 * @param {string} paramName - The parameter name from JSDoc.
 * @returns {string} The kebab-case option name with a `--` prefix.
 */
function getOptionName(paramName) {
  const kebabCase = paramName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `--${kebabCase}`;
}

/**
 * Determines if a parameter should be treated as a CLI option (flag) or a positional argument.
 *
 * The heuristic is:
 * - A parameter is an OPTION if it's not required (optional).
 * - A parameter is an ARGUMENT if it is required.
 *
 * This provides a predictable mapping: required params become arguments, optional ones become flags.
 *
 * @param {object} param - The parsed parameter object from `doclet-parser`.
 * @returns {boolean} `true` if the parameter should be an option, `false` for an argument.
 */
function isOption(param) {
  return !param.required;
}

/**
 * Builds the string representation for a commander.js argument.
 * e.g., `<name>` for required, `[name]` for optional.
 *
 * @param {object} param - The parsed parameter object.
 * @returns {string} The argument string for commander.
 */
function buildArgumentString(param) {
  return param.required ? `<${param.name}>` : `[${param.name}]`;
}

/**
 * Builds the string representation for a commander.js option (flag).
 *
 * @param {object} param - The parsed parameter object.
 * @returns {string} The option string for commander (e.g., '--name <value>').
 */
function buildOptionString(param) {
  const flag = getOptionName(param.name);

  if (BOOLEAN_FLAG_TYPES.has(param.type)) {
    // Boolean flags do not take a value.
    return flag;
  }

  if (VALUED_FLAG_TYPES.has(param.type)) {
    // Valued flags take a placeholder, e.g., <value>, <string>, <number>.
    const placeholder = param.type === 'number' ? 'number' : 'value';
    return `${flag} <${placeholder}>`;
  }

  // Default to a valued flag if type is unknown.
  return `${flag} <value>`;
}

/**
 * Generates the `.action()` part of the commander chain.
 * This code snippet is responsible for parsing options, calling the original
 * function with the correct arguments, and handling the output.
 *
 * @param {object} command - The command definition object.
 * @param {number} moduleIndex - The index of the module where the function is defined.
 * @returns {string} A string containing the `.action()` method call.
 */
function buildAction(command, moduleIndex) {
  const { name: functionName, params } = command;

  // Separate arguments and options to correctly map them.
  const args = params.filter(p => !isOption(p));
  const opts = params.filter(p => isOption(p));

  // The names of arguments as they will appear in the action handler's argument list.
  const argNames = args.map(p => p.name);

  // The final list of parameters for the action handler function.
  // e.g., (name, age, options)
  const actionParams = [...argNames, 'options'].join(', ');

  // Map CLI inputs (args and options) to the order expected by the original function.
  const callArgs = params.map(p => {
    if (isOption(p)) {
      // For options, access them from the `options` object.
      // e.g., `options.verbose`
      return `options.${p.name}`;
    } else {
      // For arguments, use the variable name directly.
      // e.g., `name`
      return p.name;
    }
  }).join(', ');

  return `
    .action(async (${actionParams}) => {
      // Call the original function from the imported module.
      const result = await module${moduleIndex}.${functionName}(${callArgs});

      // Log the result to stdout if it's not undefined.
      // This allows functions with no return value to execute silently.
      if (result !== undefined) {
        // For objects/arrays, pretty-print. For others, convert to string.
        if (typeof result === 'object' && result !== null) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(String(result));
        }
      }
    })`;
}

/**
 * Constructs a complete commander.js command definition snippet for a single function.
 *
 * This function orchestrates the process of building a full `.command()` chain.
 * It combines the command name, description, arguments, options, and the action handler
 * into a single, executable string of code.
 *
 * @param {object} command - The command definition object from `doclet-parser`.
 * @param {number} moduleIndex - The index of the file/module containing the function.
 *   This is used to reference the correct imported module (e.g., `module0`, `module1`).
 * @returns {string} A string representing a complete commander command definition.
 * @throws {Error} If the command object is invalid or missing required properties.
 */
export function buildCommandSnippet(command, moduleIndex) {
  if (!command || !command.name || typeof moduleIndex !== 'number') {
    throw new Error('Invalid command object or module index provided to buildCommandSnippet.');
  }

  const { name, description, params } = command;

  // Start the command chain
  let snippet = `  program.command('${name}')`;

  if (description) {
    snippet += `\n    .description('${escapeString(description)}')`;
  }

  // Add arguments
  const args = params.filter(p => !isOption(p));
  args.forEach(arg => {
    const argString = buildArgumentString(arg);
    const argDescription = escapeString(arg.description);
    snippet += `\n    .argument('${argString}', '${argDescription}')`;
  });

  // Add options
  const opts = params.filter(p => isOption(p));
  opts.forEach(opt => {
    const optString = buildOptionString(opt);
    const optDescription = escapeString(opt.description);
    const defaultValue = opt.defaultValue;

    if (defaultValue !== undefined) {
      // Commander handles type coercion for default values.
      const defaultValueString = typeof defaultValue === 'string'
        ? `'${escapeString(defaultValue)}'`
        : String(defaultValue);
      snippet += `\n    .option('${optString}', '${optDescription}', ${defaultValueString})`;
    } else {
      snippet += `\n    .option('${optString}', '${optDescription}')`;
    }
  });

  // Add the action handler
  snippet += buildAction(command, moduleIndex);

  return snippet;
}