/**
 * @file src/parser/jsdoc-parser.js
 * @description Core logic to parse JSDoc comment blocks and extract structured information like type, name, description, and nested properties.
 */

/**
 * Parses a JSDoc `@param` or `@property` tag line.
 *
 * A typical line looks like: `@param {string} [name="John"] - The user's name.`
 * This function extracts the type, name, optionality, default value, and description.
 *
 * @param {string} line - The JSDoc tag line to parse.
 * @returns {{type: string, name: string, description: string, optional: boolean, defaultValue: string | undefined} | null} Parsed tag details or null if parsing fails.
 */
function parseParamLine(line) {
  // Regex to capture the main parts of a @param or @property tag.
  // Group 1: Type, e.g., {string}, {string[]}, {Object.<string, number>}
  // Group 2: Parameter name, possibly optional `[name]` or with a default `[name="default"]`
  // Group 3: Description, everything after the name part
  const paramRegex = /\{([^}]+)\}\s+([^-\s]+)(?:\s*-\s*(.*))?/;
  const match = line.match(paramRegex);

  if (!match) {
    return null;
  }

  let [, type, name, description = ''] = match;
  description = description.trim();
  let optional = false;
  let defaultValue;

  // Check for optional syntax `[name]` or `[name=defaultValue]`
  if (name.startsWith('[') && name.endsWith(']')) {
    optional = true;
    name = name.substring(1, name.length - 1);

    // Check for default value `name=defaultValue`
    const defaultValueMatch = name.match(/^([^=]+)=(.*)$/);
    if (defaultValueMatch) {
      name = defaultValueMatch[1];
      defaultValue = defaultValueMatch[2].replace(/['"]/g, ''); // Remove quotes
    }
  }

  return { type: type.trim(), name: name.trim(), description, optional, defaultValue };
}

/**
 * Parses a JSDoc `@returns` or `@return` tag line.
 *
 * A typical line looks like: `@returns {{id: string, name: string}} - The created user object.`
 * This function extracts the type and description.
 *
 * @param {string} line - The JSDoc tag line to parse.
 * @returns {{type: string, description: string} | null} Parsed tag details or null if parsing fails.
 */
function parseReturnsLine(line) {
  // Regex to capture the type and description for a @returns tag.
  // Group 1: Type, e.g., {string}, {Promise<User>}
  // Group 2: Description, everything after the type
  const returnsRegex = /\{([^}]+)\}(?:\s*-\s*(.*))?/;
  const match = line.match(returnsRegex);

  if (!match) {
    return null;
  }

  const [, type, description = ''] = match;
  return { type: type.trim(), description: description.trim() };
}

/**
 * Parses a clean JSDoc comment string into a structured object.
 * This function identifies the main description and various JSDoc tags
 * like `@param`, `@returns`, and `@typedef`.
 *
 * @param {string} cleanedComment - A JSDoc comment string, pre-processed by `cleanJSDocComment`.
 * @returns {{description: string, params: Array, returns: object|null, typedef: object|null}} A structured representation of the JSDoc comment.
 */
export function parseJSDoc(cleanedComment) {
  const lines = cleanedComment.split('\n');
  const result = {
    description: '',
    params: [],
    returns: null,
    typedef: null,
  };

  const descriptionLines = [];
  let isParsingDescription = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('@')) {
      isParsingDescription = false; // Stop capturing description once a tag is found
    }

    if (isParsingDescription && trimmedLine) {
      descriptionLines.push(trimmedLine);
      continue;
    }

    if (trimmedLine.startsWith('@param')) {
      const paramData = parseParamLine(trimmedLine.substring('@param'.length).trim());
      if (paramData) {
        result.params.push(paramData);
      }
    } else if (trimmedLine.startsWith('@returns') || trimmedLine.startsWith('@return')) {
      const returnsData = parseReturnsLine(trimmedLine.substring(trimmedLine.startsWith('@returns') ? '@returns'.length : '@return'.length).trim());
      if (returnsData) {
        result.returns = returnsData;
      }
    } else if (trimmedLine.startsWith('@typedef')) {
      // For @typedef, we treat it like a @returns tag but store it separately.
      // e.g., @typedef {{id: string, name: string}} User
      const typedefLine = trimmedLine.substring('@typedef'.length).trim();
      const typedefRegex = /\{([^}]+)\}\s+([^\s]+)/;
      const match = typedefLine.match(typedefRegex);

      if (match) {
        const [, type, name] = match;
        result.typedef = { type, name };
        // Any properties for the typedef are parsed as @property tags.
      }
    } else if (trimmedLine.startsWith('@property')) {
      // @property is treated like @param but for @typedef objects.
      const propData = parseParamLine(trimmedLine.substring('@property'.length).trim());
      if (propData) {
        // We add properties to a 'properties' array within the typedef object.
        if (!result.typedef) {
          // This can happen if @property is used without a @typedef.
          // We'll create a placeholder typedef.
          result.typedef = { type: 'Object', name: 'UnknownType', properties: [] };
        }
        if (!result.typedef.properties) {
          result.typedef.properties = [];
        }
        result.typedef.properties.push(propData);
      }
    }
  }

  result.description = descriptionLines.join(' ');
  return result;
}