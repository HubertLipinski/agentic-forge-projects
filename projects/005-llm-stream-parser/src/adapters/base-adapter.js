/**
 * @file src/adapters/base-adapter.js
 * @description Abstract base class defining the interface for all provider-specific adapters.
 *
 * This file establishes the contract that all provider-specific adapters (like OpenAI,
 * Anthropic, etc.) must follow. By defining a common interface, the core stream parser
 * can process data from any supported LLM provider in a generic way.
 *
 * The primary responsibility of an adapter is to implement the `normalize` method,
 * which translates a provider-specific data chunk into a standardized, unified format.
 *
 * This class is designed to be extended, not instantiated directly. Attempting to
 * call methods on the base class will result in an error, enforcing the implementation
 * of the required methods in child classes.
 */

import { StreamError } from '../errors/StreamError.js';

/**
 * @typedef {object} NormalizedChunk
 * @property {string | null} id - A unique identifier for the stream or event.
 * @property {string | null} event - The type of event (e.g., 'message_delta', 'completion').
 * @property {string | null} data - The primary content payload, typically a piece of the generated text.
 * @property {boolean} done - A flag indicating if this is the final chunk in the stream.
 * @property {object | null} raw - The original, unprocessed JSON object from the provider.
 */

/**
 * An abstract base class that defines the interface for provider-specific stream adapters.
 *
 * All adapters must extend this class and implement the `normalize` method.
 * This ensures that the main parser can handle different stream formats through a
 * consistent, polymorphic interface.
 *
 * @abstract
 */
export class BaseAdapter {
  /**
   * Constructs a new BaseAdapter.
   *
   * @throws {Error} if this class is instantiated directly.
   */
  constructor() {
    if (this.constructor === BaseAdapter) {
      throw new Error("Abstract class 'BaseAdapter' cannot be instantiated directly.");
    }
  }

  /**
   * Normalizes a provider-specific JSON object into a unified format.
   *
   * This is the core method that child classes must implement. It takes a parsed
   * JSON object from a stream chunk and transforms it into a standard `NormalizedChunk` object.
   *
   * @abstract
   * @param {object} chunk - The parsed JSON object from a single stream event.
   * @returns {NormalizedChunk} A standardized chunk object.
   * @throws {StreamError} If the chunk is malformed or cannot be normalized.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  normalize(chunk) {
    // This is a placeholder to ensure subclasses implement this method.
    // The `unused` parameter is a convention to signal it's intentionally not used here.
    const _unused = chunk;
    throw new Error(`'normalize' method must be implemented by subclass: ${this.constructor.name}`);
  }
}