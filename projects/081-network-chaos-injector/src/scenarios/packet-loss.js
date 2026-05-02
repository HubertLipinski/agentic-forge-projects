/**
 * @file src/scenarios/packet-loss.js
 * @description Chaos scenario implementation for simulating network failure by destroying the client request socket.
 * This scenario mimics a sudden connection drop, causing the request to fail with a 'socket hang up'
 * or similar connection error, testing the application's ability to handle abrupt network failures.
 */

import { ConfigValidationError } from '../utils/config-validator.js';

/**
 * Validates the options for the packet loss scenario.
 *
 * @param {object} [options] - The scenario-specific configuration.
 * @param {number} [options.delay] - A delay in milliseconds before destroying the request.
 * @throws {ConfigValidationError} if the options are invalid.
 */
function validatePacketLossOptions(options) {
  // Packet loss can be configured with no options, which means immediate destruction.
  if (options === undefined || options === null) {
    return;
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new ConfigValidationError('PacketLoss scenario options must be an object if provided.', 'scenario.options');
  }

  const { delay } = options;

  if (delay !== undefined) {
    if (typeof delay !== 'number' || !Number.isInteger(delay) || delay < 0) {
      throw new ConfigValidationError("Option 'delay' must be a non-negative integer.", 'scenario.options.delay');
    }
  }

  // Ensure no other unexpected properties are present, which could indicate a typo.
  const allowedKeys = ['delay'];
  const unknownKeys = Object.keys(options).filter(key => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new ConfigValidationError(`Unknown options found: ${unknownKeys.join(', ')}.`, 'scenario.options');
  }
}

/**
 * Creates a promise that resolves after a specified duration.
 *
 * @param {number} duration - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the timer completes.
 */
function wait(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Applies the packet loss chaos scenario.
 * It first allows the original request to be created, then destroys it to simulate a connection failure.
 * This will typically cause an 'error' event with a 'ECONNRESET' or 'socket hang up' code to be
 * emitted on the ClientRequest object.
 *
 * @param {Function} originalRequestFn - The original `http.request` or `https.request` function.
 * @param {Array<any>} originalRequestArgs - The arguments passed to the original request function.
 * @param {object} [scenarioOptions] - The scenario-specific configuration from the matched rule.
 * @returns {Promise<import('http').ClientRequest>} A promise that resolves with the ClientRequest.
 */
export async function apply(originalRequestFn, originalRequestArgs, scenarioOptions) {
  validatePacketLossOptions(scenarioOptions);

  const delay = scenarioOptions?.delay ?? 0;

  // First, we must create the actual request object by calling the original function.
  // We cannot destroy a request that doesn't exist yet.
  const clientRequest = originalRequestFn(...originalRequestArgs);

  // The destruction logic must be detached from the main execution flow
  // to allow the `clientRequest` to be returned immediately.
  const destroyRequest = async () => {
    try {
      if (delay > 0) {
        await wait(delay);
      }

      // Check if the request has already been finished or destroyed by the application code.
      // The `destroyed` property is the canonical way to check this.
      if (!clientRequest.destroyed) {
        const error = new Error('Chaos-Injected: Socket connection destroyed to simulate packet loss.');
        error.code = 'CHAOS_PACKET_LOSS';
        clientRequest.destroy(error);
      }
    } catch (err) {
      // This catch block is a safeguard. In practice, `clientRequest.destroy`
      // should not throw. If it does, we emit it as an error on the request
      // to ensure the application's error handlers can see it.
      if (!clientRequest.destroyed) {
        clientRequest.emit('error', err);
      }
    }
  };

  // Run the destruction logic without blocking the return of the clientRequest.
  // We don't need to `await` this promise here.
  destroyRequest();

  // Return the request object immediately. The application code will attach its
  // 'error' and 'response' listeners to this object. Our `destroyRequest` logic
  // will trigger the 'error' listener.
  return clientRequest;
}