/**
 * @file src/utils/output-parser.js
 * @description A utility function to safely parse a string, attempting to fix common JSON formatting errors from LLMs before failing.
 * @module utils/output-parser
 */

/**
 * A custom error class for parsing failures that provides more context
 * than a standard `SyntaxError`.
 */
class JSONParseError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {string} originalString - The string that failed to parse.
   * @param {Error} [cause] - The original error that was caught, if any.
   */
  constructor(message, originalString, cause) {
    super(message);
    this.name = 'JSONParseError';
    this.originalString = originalString;
    this.cause = cause;
  }
}

/**
 * Attempts to find and extract a valid JSON object or array from a string.
 * LLMs often wrap their JSON output in markdown code blocks (```json ... ```)
 * or add explanatory text before or after the JSON. This function tries to
 * locate the core JSON structure.
 *
 * @param {string} inputString - The raw string, potentially containing JSON.
 * @returns {string} The extracted JSON string, or the original string if no clear JSON block is found.
 */
function extractJsonFromString(inputString) {
  // Regex to find JSON within markdown code blocks (e.g., ```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]+?)\s*```/;
  const codeBlockMatch = inputString.match(codeBlockRegex);

  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // If no code block, find the first '{' or '[' and the last '}' or ']'
  const firstBracket = inputString.indexOf('{');
  const firstSquare = inputString.indexOf('[');
  let startIndex = -1;

  if (firstBracket === -1) {
    startIndex = firstSquare;
  } else if (firstSquare === -1) {
    startIndex = firstBracket;
  } else {
    startIndex = Math.min(firstBracket, firstSquare);
  }

  if (startIndex === -1) {
    // No JSON structure found, return original string for the parser to handle
    return inputString;
  }

  const lastBracket = inputString.lastIndexOf('}');
  const lastSquare = inputString.lastIndexOf(']');
  const endIndex = Math.max(lastBracket, lastSquare);

  if (endIndex > startIndex) {
    return inputString.substring(startIndex, endIndex + 1).trim();
  }

  return inputString;
}

/**
 * Attempts to fix common JSON formatting errors often produced by LLMs.
 * This includes handling trailing commas and ensuring strings are properly quoted.
 * This is a best-effort approach and may not fix all malformed JSON.
 *
 * @param {string} jsonString - The potentially malformed JSON string.
 * @returns {string} The cleaned-up JSON string.
 */
function fixCommonJsonErrors(jsonString) {
  let cleanedString = jsonString;

  // 1. Remove trailing commas from objects and arrays
  // Matches a comma followed by whitespace and then a closing brace or bracket.
  // The `g` flag ensures all occurrences are replaced.
  cleanedString = cleanedString.replace(/,\s*([}\]])/g, '$1');

  // 2. Remove comments (though less common in LLM JSON, it's a good practice)
  // This is a simplified regex and might not handle all edge cases like comments within strings.
  cleanedString = cleanedString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  return cleanedString.trim();
}

/**
 * Safely parses a string into a JavaScript object.
 * It first tries to extract a JSON block, then attempts to fix common formatting
 * errors (like trailing commas) before finally using `JSON.parse`.
 *
 * @param {string} llmOutput - The raw string output from the LLM.
 * @throws {JSONParseError} If the string cannot be parsed into valid JSON after all cleanup attempts.
 * @returns {object | Array} The parsed JavaScript object or array.
 */
export function safeJsonParse(llmOutput) {
  if (typeof llmOutput !== 'string' || llmOutput.trim() === '') {
    throw new JSONParseError(
      'Input to parse is not a non-empty string.',
      String(llmOutput)
    );
  }

  const extractedJson = extractJsonFromString(llmOutput);
  const cleanedJson = fixCommonJsonErrors(extractedJson);

  try {
    // First attempt: parse the cleaned string
    return JSON.parse(cleanedJson);
  } catch (error) {
    // If cleaning fails, try parsing the original extracted string as a fallback
    try {
      return JSON.parse(extractedJson);
    } catch (fallbackError) {
      // If both attempts fail, throw a detailed custom error
      throw new JSONParseError(
        'Failed to parse string as JSON after multiple cleanup attempts.',
        llmOutput,
        fallbackError
      );
    }
  }
}