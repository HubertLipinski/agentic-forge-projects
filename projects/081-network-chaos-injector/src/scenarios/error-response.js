/**
 * @file src/scenarios/error-response.js
 * @description Chaos scenario implementation for intercepting a request and returning a forged HTTP error response.
 * This scenario prevents the actual network request from being made and instead simulates
 * an immediate error response from the server (e.g., 503 Service Unavailable, 429 Too Many Requests).
 */

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { ConfigValidationError } from '../utils/config-validator.js';

/**
 * A mock ClientRequest that mimics the behavior of a real `http.ClientRequest`.
 * It emits 'response' with a mock IncomingMessage and handles 'error' events.
 * This allows us to short-circuit the request cycle without hitting the network.
 */
class MockClientRequest extends EventEmitter {
  /**
   * @param {MockIncomingMessage} mockResponse - The forged response to be emitted.
   */
  constructor(mockResponse) {
    super();
    this.mockResponse = mockResponse;
    this.aborted = false;

    // The 'response' event must be emitted asynchronously, after the current event loop tick,
    // to allow listeners to be attached to the request object.
    process.nextTick(() => {
      if (!this.aborted) {
        this.emit('response', this.mockResponse);
        // After emitting the response, the response stream can be piped.
        this.mockResponse.startDataFlow();
      }
    });
  }

  /**
   * Simulates the end of the request. For our mock, this is a no-op but is
   * required for compatibility with the http.ClientRequest interface.
   * @param {any} _chunk - The request body chunk.
   * @param {any} _encoding - The encoding of the chunk.
   * @param {any} _callback - A callback to be invoked when the write is complete.
   */
  end(_chunk, _encoding, _callback) {
    // The request is "sent" immediately. No action needed.
    return this;
  }

  /**
   * Simulates writing data to the request. A no-op for our mock.
   * @param {any} _chunk - The request body chunk.
   * @param {any} _encoding - The encoding of the chunk.
   * @param {any} _callback - A callback to be invoked when the write is complete.
   */
  write(_chunk, _encoding, _callback) {
    // Data written to the request is ignored as we are forging a response.
    return true;
  }

  /**
   * Simulates aborting the request. This prevents the 'response' event from firing.
   */
  abort() {
    if (!this.aborted) {
      this.aborted = true;
      this.emit('abort');
      // In a real scenario, this might also destroy the socket. Here, we just
      // ensure no further events are emitted.
    }
  }

  /**
   * Simulates destroying the request with an error.
   * @param {Error} error - The error to emit.
   */
  destroy(error) {
    if (!this.aborted) {
      this.aborted = true;
      if (error) {
        this.emit('error', error);
      }
      this.emit('close');
    }
  }
}

/**
 * A mock IncomingMessage that mimics `http.IncomingMessage`.
 * It's a Readable stream that provides the forged status code, headers, and body.
 */
class MockIncomingMessage extends Readable {
  /**
   * @param {object} options
   * @param {number} options.statusCode - The HTTP status code.
   * @param {string} options.statusMessage - The HTTP status message.
   * @param {object} options.headers - The response headers.
   * @param {string} options.body - The response body.
   */
  constructor({ statusCode, statusMessage, headers, body }) {
    super();
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
    this.headers = headers;
    this.body = body;
    this.complete = false;
    this.httpVersion = '1.1';
    this.rawHeaders = Object.entries(headers).flat();
  }

  /**
   * Pushes the response body to the stream and signals its end.
   * This is called after the 'response' event has been emitted on the ClientRequest.
   */
  startDataFlow() {
    if (this.body) {
      this.push(this.body, 'utf8');
    }
    this.push(null); // Signal end of stream
    this.complete = true;
    this.emit('end');
  }

  /**
   * Required method for Readable streams. We handle data flow in `startDataFlow`.
   */
  _read() {
    // Data is pushed on demand by `startDataFlow`.
  }
}

/**
 * Validates the options for the error response scenario.
 *
 * @param {object} options - The scenario-specific configuration.
 * @param {number} options.statusCode - The HTTP status code to return.
 * @param {string} [options.statusMessage] - The corresponding status message.
 * @param {string} [options.body] - The response body to send.
 * @param {object} [options.headers] - The response headers to send.
 * @throws {ConfigValidationError} if the options are invalid.
 */
function validateErrorResponseOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new ConfigValidationError('ErrorResponse scenario requires an options object.', 'scenario.options');
  }

  const { statusCode, statusMessage, body, headers } = options;

  if (statusCode === undefined) {
    throw new ConfigValidationError("Option 'statusCode' is required.", 'scenario.options.statusCode');
  }
  if (typeof statusCode !== 'number' || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new ConfigValidationError("Option 'statusCode' must be an integer between 100 and 599.", 'scenario.options.statusCode');
  }

  if (statusMessage !== undefined && typeof statusMessage !== 'string') {
    throw new ConfigValidationError("Option 'statusMessage' must be a string if provided.", 'scenario.options.statusMessage');
  }

  if (body !== undefined && typeof body !== 'string') {
    throw new ConfigValidationError("Option 'body' must be a string if provided.", 'scenario.options.body');
  }

  if (headers !== undefined && (typeof headers !== 'object' || headers === null || Array.isArray(headers))) {
    throw new ConfigValidationError("Option 'headers' must be an object if provided.", 'scenario.options.headers');
  }
}

/**
 * Applies the error response chaos scenario.
 * It bypasses the original request function and immediately returns a mock request
 * object that will emit a forged error response.
 *
 * @param {Function} _originalRequestFn - The original `http.request` or `https.request` function (unused).
 * @param {Array<any>} _originalRequestArgs - The arguments passed to the original request function (unused).
 * @param {object} scenarioOptions - The scenario-specific configuration from the matched rule.
 * @returns {Promise<MockClientRequest>} A promise that resolves with a mock ClientRequest.
 */
export async function apply(_originalRequestFn, _originalRequestArgs, scenarioOptions) {
  validateErrorResponseOptions(scenarioOptions);

  const {
    statusCode,
    statusMessage = 'Chaos-Injected Error',
    body = `{"error": "This is a simulated error from network-chaos-injector"}`,
    headers: customHeaders = {},
  } = scenarioOptions;

  const responseBody = Buffer.from(body, 'utf8');

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': responseBody.length.toString(),
    'X-Chaos-Injected': 'error-response',
    ...customHeaders,
  };

  const mockResponse = new MockIncomingMessage({
    statusCode,
    statusMessage,
    headers,
    body: responseBody,
  });

  const mockRequest = new MockClientRequest(mockResponse);

  // The apply function in the interceptor expects a Promise, so we wrap the result.
  return Promise.resolve(mockRequest);
}