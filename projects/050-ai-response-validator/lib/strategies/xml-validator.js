/**
 * @file lib/strategies/xml-validator.js
 * @description Implements the validation strategy for XML data using fast-xml-parser.
 * @module lib/strategies/xml-validator
 */

import { XMLParser } from 'fast-xml-parser';
import { VALIDATION_STRATEGIES } from '../constants.js';

/**
 * A validation strategy for ensuring a string is well-formed XML.
 *
 * This class leverages the `fast-xml-parser` library to perform a syntax
 * check on the input string. It does not validate against a DTD or XSD schema,
 * focusing solely on whether the XML is syntactically correct.
 */
export class XmlValidator {
  /**
   * The unique identifier for this validation strategy.
   * @type {string}
   */
  static name = VALIDATION_STRATEGIES.XML;

  /**
   * The `fast-xml-parser` instance used for validation.
   * It is configured to throw an error on invalid XML, which is how we detect
   * validation failure.
   * @type {XMLParser}
   * @private
   */
  #parser;

  /**
   * Creates an instance of XmlValidator.
   * @param {object} [options={}] - Configuration options for the XML parser.
   * These options are passed directly to `fast-xml-parser`.
   */
  constructor(options = {}) {
    // The core of the validation is to attempt parsing and catch errors.
    // We pass any user-provided options but ensure stopNodes is empty
    // to parse the full document, and allowBooleanAttributes is true
    // for flexibility with common XML patterns.
    const parserOptions = {
      allowBooleanAttributes: true,
      ...options,
      stopNodes: [], // Ensure full document is parsed for validation
    };

    this.#parser = new XMLParser(parserOptions);
  }

  /**
   * Validates the given LLM response string to ensure it is well-formed XML.
   *
   * The method attempts to parse the input string. If parsing succeeds, the XML
   * is considered valid. If it fails, the XML is invalid, and the error from
   * the parser is captured and returned.
   *
   * @param {string} response - The string response from the LLM, expected to be XML.
   * @returns {Promise<{ isValid: boolean, data: object | null, error: string | null }>}
   * An object indicating the validation result.
   * - `isValid`: `true` if the response is well-formed XML, `false` otherwise.
   * - `data`: The parsed JavaScript object representation of the XML if validation is successful,
   *   otherwise `null`. This can be useful for downstream processing.
   * - `error`: A detailed error message if validation fails, otherwise `null`.
   */
  async validate(response) {
    try {
      const parsedData = this.#parser.parse(response, true);
      return {
        isValid: true,
        data: parsedData,
        error: null,
      };
    } catch (error) {
      // fast-xml-parser throws an error on malformed XML.
      // We capture this error to provide a meaningful failure message.
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown parsing error occurred.';

      return {
        isValid: false,
        data: null,
        error: `Invalid XML: The response could not be parsed. Error: ${errorMessage}`,
      };
    }
  }
}