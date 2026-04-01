/**
 * @file examples/basic-json-validation.js
 * @description Demonstrates validating a response from a mock LLM API against a JSON schema.
 * This example showcases the core functionality of the library: defining a schema,
 * creating a validator, and handling the success/failure of the validation process,
 * including the automatic repair loop.
 */

import { createValidator, STRATEGIES } from '../index.js';
import { MaxRetriesExceededError } from '../lib/errors.js';

// --- 1. Define the expected JSON structure ---
// This is a standard JSON Schema object. The validator will ensure the LLM's
// output conforms to this structure.
const userProfileSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: "The user's full name.",
    },
    age: {
      type: 'number',
      minimum: 0,
      description: 'The age of the user in years.',
    },
    isStudent: {
      type: 'boolean',
      description: 'Indicates whether the user is currently a student.',
    },
    courses: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'A list of courses the user is enrolled in.',
    },
  },
  required: ['name', 'age', 'isStudent'],
};

// --- 2. Create a Mock LLM Handler ---
// In a real application, this function would make an API call to an LLM service
// like OpenAI, Anthropic, or a local model. Here, we simulate the LLM's behavior.

// We use a counter to simulate the LLM's learning process during the repair loop.
let llmCallCount = 0;

/**
 * A mock function that simulates an LLM API call.
 * On the first call, it returns an invalid JSON response.
 * On subsequent calls (retries), it returns a valid response.
 * @param {string} prompt - The prompt sent to the LLM.
 * @returns {Promise<string>} The simulated raw string response from the LLM.
 */
async function mockLlmHandler(prompt) {
  llmCallCount++;
  console.log(`\n--- LLM Call #${llmCallCount} ---`);
  console.log('LLM received prompt:\n', prompt);
  console.log('--------------------------');

  // Simulate a delay as if calling a real network API.
  await new Promise((resolve) => setTimeout(resolve, 200));

  // On the first attempt, the "LLM" makes a mistake.
  // It returns the 'age' as a string instead of a number, violating the schema.
  if (llmCallCount === 1) {
    console.log('LLM is generating an INVALID response...');
    return `
      // Here is the user profile you requested.
      {
        "name": "Jane Doe",
        "age": "twenty-five", // ERROR: This should be a number
        "isStudent": true,
        "courses": ["History 101", "Math 202"]
      }
    `;
  }

  // On the second attempt (the first retry), the LLM has received the
  // "repair prompt" and provides the corrected, valid JSON.
  console.log('LLM is generating a CORRECTED response...');
  return `
    {
      "name": "Jane Doe",
      "age": 25,
      "isStudent": true,
      "courses": ["History 101", "Math 202"]
    }
  `;
}

// --- 3. Configure and Create the Validator ---
// We instantiate the validator with our schema and the mock LLM handler.
// The `type` tells the validator to use the JSON strategy.
const validator = createValidator({
  type: STRATEGIES.JSON,
  strategyOptions: { schema: userProfileSchema },
  llmHandler: mockLlmHandler,
  maxRetries: 2, // Allow up to 2 retries after the initial attempt.
});

// --- 4. Run the Validation Process ---
async function main() {
  console.log('🚀 Starting LLM validation example...');
  console.log(
    'The validator will first receive an invalid JSON and then trigger a repair loop.',
  );

  const initialPrompt =
    'Generate a JSON object for a user named Jane Doe, who is a 25-year-old student taking History and Math.';

  try {
    // The `validate` method orchestrates the entire process:
    // 1. Calls the `llmHandler` with the initial prompt.
    // 2. Validates the response against the JSON schema.
    // 3. On failure, constructs a repair prompt and retries.
    // 4. On success, returns the parsed data.
    const result = await validator.validate(initialPrompt);

    if (result.success) {
      console.log('\n✅ Validation Successful!');
      console.log(`- Succeeded after ${result.attempts} attempt(s).`);
      console.log(`- Repair was needed: ${result.metadata.wasRepaired}`);
      console.log('- Final validated data:');
      console.dir(result.data, { depth: null });
    } else {
      // This block would be reached if retries were exhausted.
      console.error('\n❌ Validation Failed after all retries.');
      console.error(`- Error: ${result.error.message}`);

      if (result.error instanceof MaxRetriesExceededError) {
        console.error('- Last invalid response received:');
        console.error(result.metadata.lastInvalidResponse);
      }
    }
  } catch (error) {
    // This catches unexpected errors, like configuration issues.
    console.error('\n🚨 An unexpected error occurred:', error);
  }
}

main();