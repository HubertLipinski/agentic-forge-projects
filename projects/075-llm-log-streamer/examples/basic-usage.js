/**
 * @file examples/basic-usage.js
 * @description An example Node.js script showing how to use the OpenAI client pointed at the local log streamer proxy.
 *
 * This script demonstrates how to configure the official `openai` Node.js library
 * to send its requests to the `llm-log-streamer` proxy instead of the default
 * `https://api.openai.com`.
 *
 * It showcases two common use cases:
 * 1. A standard, non-streaming API call (`chat.completions.create`).
 * 2. A streaming API call, processing the response chunks as they arrive.
 *
 * ## Prerequisites
 * 1. `llm-log-streamer` must be running. You can start it with:
 *    `npx llm-log-streamer` or `node bin/cli.js`
 *
 * 2. You need to have the `openai` library installed in your project:
 *    `npm install openai`
 *
 * 3. An OpenAI API key must be available in the `OPENAI_API_KEY` environment variable.
 *    The proxy will forward this key to OpenAI, but it will be masked in the logs.
 *
 * ## How it works
 * By setting the `baseURL` option in the OpenAI client constructor to the address
 * of the local proxy (default: `http://127.0.0.1:8080`), all subsequent API calls
 * made with this client instance will be routed through the proxy. The proxy then
 * forwards the requests to OpenAI, logs the entire interaction, and streams the
 * response back to this script.
 */

import OpenAI from 'openai';

// --- Configuration ---

// The base URL of your running llm-log-streamer proxy.
// This should match the host and port the proxy server is listening on.
const PROXY_BASE_URL = 'http://127.0.0.1:8080/v1';

// A dummy API key is used here because the OpenAI client requires one.
// The actual, valid OpenAI API key should be present in the `Authorization` header
// when you run this script, typically by setting the `OPENAI_API_KEY` environment variable.
// The proxy will then forward this real key to OpenAI.
const DUMMY_API_KEY = 'sk-1234567890abcdef1234567890abcdef';

// --- Main Example Function ---

async function main() {
  console.log(
    `Configuring OpenAI client to use proxy at: ${PROXY_BASE_URL}`,
  );

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      '\n[WARNING] OPENAI_API_KEY environment variable is not set.',
    );
    console.warn(
      'The API calls will likely fail at the OpenAI endpoint, but you should still see the requests being logged by the proxy.\n',
    );
  }

  const openai = new OpenAI({
    apiKey: DUMMY_API_KEY, // The client requires an API key, but the proxy will use the one from the Authorization header.
    baseURL: PROXY_BASE_URL,
  });

  try {
    // --- Example 1: Non-streaming Chat Completion ---
    console.log('\n--- 1. Making a non-streaming API call... ---');
    console.log(
      'Check the llm-log-streamer console to see the full request/response log.',
    );

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });

    console.log('\nResponse from proxy:');
    console.log(chatCompletion.choices[0].message);
    console.log(
      `Token usage: ${chatCompletion.usage?.total_tokens} tokens.`,
    );
  } catch (error) {
    console.error('\n[ERROR] Non-streaming call failed:', error.message);
  }

  try {
    // --- Example 2: Streaming Chat Completion ---
    console.log('\n--- 2. Making a streaming API call... ---');
    console.log(
      'Check the llm-log-streamer console to see the request and captured stream chunks.',
    );

    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Write a short, 3-line poem about Node.js.' },
      ],
      stream: true,
    });

    console.log('\nStreaming response from proxy:');
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      // Write content to the same line to show the streaming effect.
      process.stdout.write(content);
    }
    // Add a newline after the stream is complete.
    process.stdout.write('\n');

    console.log('\nStream finished.');
  } catch (error) {
    console.error('\n[ERROR] Streaming call failed:', error.message);
  }
}

// Execute the main function.
main().catch((err) => {
  console.error('\nAn unexpected error occurred in the example script:', err);
  process.exit(1);
});