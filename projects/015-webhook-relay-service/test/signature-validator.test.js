/**
 * @fileoverview Unit tests for the signature-validator module.
 *
 * These tests verify the correctness of the HMAC-SHA256 signature validation logic
 * using Node.js's built-in `node:test` and `node:assert` modules. The tests cover
 * various scenarios, including valid signatures, invalid signatures, missing headers,
 * malformed headers, and edge cases like empty request bodies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateSignature } from '../src/services/signature-validator.js';

// --- Test Setup ---

const TEST_SECRET = 'this-is-a-super-secret-key-for-testing';
const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';

/**
 * A mock logger to be attached to the mock request object.
 * It provides `warn` and `error` methods that can be spied on or checked,
 * but for these tests, a simple no-op implementation is sufficient as we
 * are primarily concerned with the boolean return value of `validateSignature`.
 */
const mockLogger = {
  warn: () => {},
  error: () => {},
  info: () => {},
};

/**
 * Helper function to create a mock Fastify request object for testing.
 *
 * @param {object} options - Options to build the mock request.
 * @param {object} [options.headers={}] - The headers for the request.
 * @param {string | Buffer | null} [options.rawBody=null] - The raw body of the request.
 * @returns {object} A mock request object with `headers`, `rawBody`, and `log` properties.
 */
const createMockRequest = ({ headers = {}, rawBody = null } = {}) => ({
  headers,
  rawBody,
  log: mockLogger,
});

/**
 * Helper function to generate a valid HMAC-SHA256 signature for a given payload.
 *
 * @param {string} payload - The content to sign.
 * @param {string} secret - The secret key.
 * @returns {string} The full signature header value (e.g., 'sha256=...').
 */
const generateValidSignatureHeader = (payload, secret) => {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${SIGNATURE_PREFIX}${signature}`;
};

// --- Test Suites ---

describe('validateSignature', () => {
  it('should return true for a valid signature and correct payload', () => {
    const payload = JSON.stringify({ event: 'test', data: 'some-data' });
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, true, 'Expected signature to be valid');
  });

  it('should return true for a valid signature with an empty JSON object payload', () => {
    const payload = '{}';
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, true, 'Expected signature for empty JSON object to be valid');
  });

  it('should return true for a valid signature with an empty string payload', () => {
    const payload = '';
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, true, 'Expected signature for empty string payload to be valid');
  });

  it('should return false if the signature header is missing', () => {
    const payload = JSON.stringify({ event: 'test' });
    const request = createMockRequest({
      headers: {}, // No signature header
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail without a signature header');
  });

  it('should return false if the signature header is malformed (missing prefix)', () => {
    const payload = JSON.stringify({ event: 'test' });
    const signature = 'some-invalid-signature-without-prefix';
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signature },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail with a malformed header');
  });

  it('should return false if the signature header is not a string', () => {
    const payload = JSON.stringify({ event: 'test' });
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: 12345 }, // Invalid header type
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail when header is not a string');
  });

  it('should return false for an incorrect secret', () => {
    const payload = JSON.stringify({ event: 'test' });
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, 'wrong-secret');
    assert.strictEqual(isValid, false, 'Expected signature to be invalid with the wrong secret');
  });

  it('should return false for a mismatched payload', () => {
    const originalPayload = JSON.stringify({ event: 'test' });
    const tamperedPayload = JSON.stringify({ event: 'tampered' });
    const signatureHeader = generateValidSignatureHeader(originalPayload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(tamperedPayload), // Body does not match what was signed
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected signature to be invalid with a tampered payload');
  });

  it('should return false for an incorrect signature', () => {
    const payload = JSON.stringify({ event: 'test' });
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: `${SIGNATURE_PREFIX}0000000000000000000000000000000000000000000000000000000000000000` },
      rawBody: Buffer.from(payload),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail with an incorrect signature');
  });

  it('should return false if request.rawBody is null', () => {
    const payload = JSON.stringify({ event: 'test' });
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: null, // rawBody is missing
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail when rawBody is null');
  });

  it('should return false if request.rawBody is undefined', () => {
    const payload = JSON.stringify({ event: 'test' });
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: undefined, // rawBody is missing
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, false, 'Expected validation to fail when rawBody is undefined');
  });

  it('should handle payloads with special UTF-8 characters correctly', () => {
    const payload = JSON.stringify({ message: '你好, world! 🌍' });
    const signatureHeader = generateValidSignatureHeader(payload, TEST_SECRET);
    const request = createMockRequest({
      headers: { [SIGNATURE_HEADER]: signatureHeader },
      rawBody: Buffer.from(payload, 'utf-8'),
    });

    const isValid = validateSignature(request, TEST_SECRET);
    assert.strictEqual(isValid, true, 'Expected signature to be valid for payloads with UTF-8 characters');
  });
});