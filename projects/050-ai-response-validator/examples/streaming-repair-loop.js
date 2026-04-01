/**
 * @file examples/streaming-repair-loop.js
 * @description Advanced example showing how to handle a streaming response and trigger the repair loop if the final aggregated response is invalid.
 */

import { Readable } from 'stream';
import { createValidator, STRATEGIES } from '../index.js';

// --- Mock LLM Setup ---

// This mock LLM simulates a streaming API. It keeps track of calls to demonstrate the repair loop.
let callCount = 0;

const validJsonResponse = '{ "user": { "id": "abc-123", "email": "test@example.com" }, "status": "active" }';
const invalidJsonResponse = '{ "user": { "id": "abc-123", "email": "test@example.com" }, "status": "pending"'; // Malformed JSON (missing closing brace)

/**
 * A mock LLM handler that simulates a streaming response.
 * On the first call, it returns a malformed JSON stream.
 * On subsequent calls (i.e., repair attempts), it returns a valid JSON stream.
 *
 * @param {string} prompt - The prompt sent to the LLM.
 * @returns {Promise<Readable>} A Node.js Readable stream that yields chunks of the response.
 */
async function mockStreamingLlmHandler(prompt) {
  callCount++;
  console.log(`\n--- LLM Call #${callCount} ---`);
  console.log(`LLM received prompt:\n"${prompt.trim()}"`);

  let responseString;
  if (callCount === 1) {
    // First attempt: return an invalid, incomplete JSON stream.
    console.log('LLM is generating an INVALID streaming response...');
    responseString = invalidJsonResponse;
  } else {
    // Subsequent attempts: return a valid JSON stream.
    console.log('LLM is generating a CORRECTED streaming response...');
    responseString = validJsonResponse;
  }

  // Simulate a streaming response by breaking the string into chunks.
  const chunks = responseString.match(/.{1,10}/g) || []; // Split into chunks of up to 10 chars

  const stream = new Readable({
    read() {
      if (chunks.length === 0) {
        this.push(null); // End of stream
      } else {
        const chunk = chunks.shift();
        // Simulate a small delay between chunks
        setTimeout(() => this.push(chunk), 50);
      }
    },
  });

  return stream;
}

// --- Validator Configuration ---

// Define the JSON schema we expect the LLM to adhere to.
const userProfileSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
      required: ['id', 'email'],
    },
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
  required: ['user', 'status'],
};

// Create a validator instance.
// It's configured to use the JSON strategy with our schema and the streaming LLM handler.
const validator = createValidator({
  type: STRATEGIES.JSON,
  strategyOptions: { schema: userProfileSchema },
  llmHandler: mockStreamingLlmHandler,
  maxRetries: 2,
});

// --- Main Execution Logic ---

/**
 * Main function to run the streaming validation example.
 */
async function runStreamingValidation() {
  console.log('Starting validation process with a streaming LLM response...');
  const initialPrompt = 'Generate a user profile in JSON format with an active status.';

  try {
    // The `validate` method will automatically handle the stream:
    // 1. It will call `mockStreamingLlmHandler` which returns a Readable stream.
    // 2. The validator's internal logic will aggregate all chunks from the stream into a single string.
    // 3. It will then attempt to validate the aggregated string.
    // 4. On failure, it constructs a repair prompt and retries the process.
    const result = await validator.validate(initialPrompt);

    console.log('\n--- Validation Result ---');

    if (result.success) {
      console.log('✅ Validation Succeeded!');
      console.log(`- Total attempts: ${result.attempts}`);
      console.log(`- Was repaired: ${result.metadata.wasRepaired}`);
      console.log('- Validated Data:', result.data);
      console.log('- Final Raw Response:', result.metadata.rawResponse);
    } else {
      // This block would run if retries were exhausted.
      console.error('❌ Validation Failed after all retries.');
      console.error(`- Total attempts: ${result.attempts}`);
      console.error(`- Final Error: ${result.error.name}`);
      console.error(`- Error Message: ${result.error.message}`);
      // The `cause` property shows the chain of errors.
      console.error('- Last Validation Error:', result.error.cause?.message);
    }
  } catch (error) {
    // This catches unexpected errors during validator setup or execution.
    console.error('An unexpected error occurred:', error);
  }
}

// Execute the example.
runStreamingValidation();