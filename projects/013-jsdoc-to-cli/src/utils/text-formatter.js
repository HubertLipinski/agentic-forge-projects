/**
 * @file src/utils/text-formatter.js
 * @description Contains utility functions for formatting text, such as converting
 * case styles for CLI flags and generating the help screen layout.
 */

/**
 * Converts a camelCase string to kebab-case.
 * This is used to transform JavaScript variable names into conventional CLI flag names.
 * e.g., 'myVarName' -> 'my-var-name'
 *
 * @param {string} str The camelCase string to convert.
 * @returns {string} The resulting kebab-case string.
 */
export function camelCaseToKebabCase(str) {
  if (!str) {
    return '';
  }
  // Handles cases like 'myVar' -> 'my-var' and 'MyVar' -> '-my-var' (which is fine for yargs)
  // The regex finds an uppercase letter [A-Z] and replaces it with a hyphen and the lowercase version.
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Generates a formatted help screen string based on the parsed JSDoc and function metadata.
 *
 * @param {object} config - The configuration object.
 * @param {string} config.filePath - The path to the user's script file.
 * @param {string} config.functionName - The name of the target function.
 * @param {string} [config.functionDescription] - The description of the function from JSDoc.
 * @param {Array<object>} config.params - An array of parameter objects from `jsdoc-parser`.
 * @returns {string} The formatted help text.
 */
export function generateHelpScreen({
  filePath,
  functionName,
  functionDescription,
  params = [],
}) {
  const usageLine = `Usage: npx jsdoc-to-cli ${filePath} ${functionName} [options]`;

  const descriptionSection = functionDescription
    ? `\n${functionDescription}\n`
    : '';

  const options = params.map((param) => {
    const flag = `--${camelCaseToKebabCase(param.name)}`;
    const typeInfo = `{${param.type}}`;
    const defaultValue =
      param.default !== undefined ? ` (default: ${param.default})` : '';
    const description = param.description ? ` - ${param.description}` : '';

    return {
      flag,
      typeInfo,
      description: `${description}${defaultValue}`,
    };
  });

  // Add the standard --help flag
  options.push({
    flag: '--help',
    typeInfo: '',
    description: ' - Show this help screen.',
  });

  let optionsSection = 'Options:\n';

  if (options.length > 0) {
    // Calculate padding to align descriptions
    const maxFlagLength = Math.max(...options.map((opt) => opt.flag.length));
    const maxTypeLength = Math.max(...options.map((opt) => opt.typeInfo.length));
    const flagPadding = maxFlagLength + 2; // 2 spaces of padding
    const typePadding = maxTypeLength + 2;

    options.forEach((opt) => {
      const flagPart = `  ${opt.flag}`.padEnd(flagPadding);
      const typePart = opt.typeInfo.padEnd(typePadding);
      optionsSection += `${flagPart}${typePart}${opt.description}\n`;
    });
  } else {
    optionsSection += '  No options available for this function.\n';
  }

  return `${usageLine}\n${descriptionSection}\n${optionsSection}`;
}