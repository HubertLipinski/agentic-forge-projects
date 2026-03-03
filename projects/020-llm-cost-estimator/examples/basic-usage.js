/**
 * @file examples/basic-usage.js
 * @description A simple Node.js script demonstrating how to import and use the
 * `llm-cost-estimator` library programmatically.
 *
 * To run this example:
 * `node examples/basic-usage.js`
 */

import { estimateCost, countTokens, listAllModels } from '../src/index.js';

/**
 * A helper function to format and display the cost estimation results in a
 * readable format in the console.
 *
 * @param {Promise<object>} costPromise - A promise that resolves to the cost estimation object.
 */
async function displayCost(costPromise) {
  try {
    const result = await costPromise;
    console.log(`\n--- Estimation for ${result.provider}/${result.model} ---`);
    console.log(`Input Tokens:  ${result.inputTokens.toLocaleString()}`);
    console.log(`Output Tokens: ${result.outputTokens.toLocaleString()}`);
    console.log(`Input Cost:    $${result.inputCost.toFixed(6)}`);
    console.log(`Output Cost:   $${result.outputCost.toFixed(6)}`);
    console.log(`Total Cost:    $${result.totalCost.toFixed(6)}`);
    console.log('--------------------------------------------------');
  } catch (error) {
    // The estimator already logs the error, but we can add context here.
    console.error(`\n--- Failed to get estimation ---`);
    console.error(`Error: ${error.message}`);
    console.log('------------------------------------');
  }
}

/**
 * The main function to run all demonstration examples.
 */
async function main() {
  console.log('Running LLM Cost Estimator examples...');

  // --- Example 1: Basic cost estimation with known token counts ---
  // This is the most direct way to use the estimator if you already have
  // the token counts from an API response or a dedicated tokenizer.
  console.log('\n[Example 1: Estimating cost with pre-defined token counts]');
  await displayCost(
    estimateCost('openai', 'gpt-4o', {
      inputTokens: 15000,
      outputTokens: 4500,
    })
  );

  // --- Example 2: Estimating cost from raw text ---
  // The library will use its built-in lightweight tokenizer to estimate
  // the number of tokens for the input and output text.
  console.log('\n[Example 2: Estimating cost from raw input/output text]');
  const prompt = `
    You are a helpful assistant. Summarize the following text in three bullet points:
    "The quick brown fox jumps over the lazy dog. This classic pangram contains all
    the letters of the English alphabet. It's often used for testing typefaces
    and keyboard layouts."
  `;
  const response = `
    * It's a sentence containing every letter of the alphabet.
    * Known as a pangram.
    * Used for font and keyboard testing.
  `;

  await displayCost(
    estimateCost('anthropic', 'claude-3-haiku-20240307', {
      inputText: prompt,
      outputText: response,
    })
  );

  // --- Example 3: Using the standalone `countTokens` utility ---
  // You can use the tokenizer separately if you just need a token count estimate.
  console.log('\n[Example 3: Using the standalone `countTokens` utility]');
  const sampleText = "Hello, world! This is a test of the simple tokenizer.";
  const tokenCount = countTokens(sampleText);
  console.log(`Text: "${sampleText}"`);
  console.log(`Estimated Tokens: ${tokenCount}`);
  console.log('--------------------------------------------------');


  // --- Example 4: Handling an unsupported model ---
  // The estimator will throw a clear error if the model is not found.
  console.log('\n[Example 4: Handling an invalid or unsupported model]');
  await displayCost(
    estimateCost('openai', 'gpt-5-super-secret', {
      inputTokens: 100,
      outputTokens: 100,
    })
  );

  // --- Example 5: Listing all supported models ---
  // You can programmatically access the list of all supported models.
  console.log('\n[Example 5: Listing all supported models]');
  const allModels = listAllModels();
  console.log(`Found ${allModels.length} supported models:`);
  allModels.forEach(model => {
    console.log(`- ${model.provider}/${model.model}`);
  });
  console.log('--------------------------------------------------');

  console.log('\nExamples finished.');
}

// Run the main function and catch any top-level errors.
main().catch(error => {
  console.error('An unexpected error occurred during the example execution:', error);
  process.exit(1);
});