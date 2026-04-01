# AI Response Validator

A Node.js library for validating Large Language Model (LLM) responses against a specified format or schema, with automatic retry and repair capabilities. Ideal for developers building reliable applications on top of LLMs who need to enforce structured output like JSON, XML, or follow specific textual patterns.

[![npm version](https://badge.fury.io/js/ai-response-validator.svg)](https://badge.fury.io/js/ai-response-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

-   **Schema-based JSON Validation**: Enforce JSON output structure using [Ajv](https://ajv.js.org/).
-   **XML Well-formedness Check**: Ensure LLM responses are syntactically correct XML.
-   **Regex Pattern Matching**: Validate string output against any regular expression.
-   **Automatic Retries**: Configurable retry mechanism with exponential or fixed backoff strategies.
-   **Smart Response Repair**: Automatically generates a "repair prompt" to ask the LLM to fix its invalid output.
-   **Streaming Support**: Handles both streaming and non-streaming LLM API responses.
-   **LLM Agnostic**: Integrates with any LLM API (OpenAI, Anthropic, Gemini, etc.) via a generic handler function.
-   **Extensible**: Pluggable architecture allows you to add custom validation strategies (e.g., YAML, CSV).

## Installation

Install the package using npm:

```bash
npm install ai-response-validator
```

## Usage

The primary entry point is the `createValidator` factory function. You provide it with a configuration object specifying the validation type, options, and a handler function to call your LLM.

The `llmHandler` is a function you write that takes a prompt and returns the LLM's raw response string. This makes the library compatible with any LLM provider.

```javascript
import { createValidator, STRATEGIES } from 'ai-response-validator';

// 1. Define your LLM handler function
// This function calls your chosen LLM API.
async function myLlmHandler(prompt, options = {}) {
  // In a real app, this would make an API call to an LLM
  // For this example, we simulate an LLM that sometimes fails.
  console.log('LLM received prompt:', prompt);

  if (prompt.includes('Please provide the corrected response')) {
    // On the second attempt (the repair prompt), return a valid response.
    return '{ "name": "Jane Doe", "email": "jane.doe@example.com" }';
  }
  
  // On the first attempt, return an invalid response.
  return '{ "name": "Jane Doe", email: "jane.doe@example.com" }'; // Invalid JSON (unquoted key)
}

// 2. Define your validation schema
const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'email'],
};

// 3. Create a validator instance
const validator = createValidator({
  type: STRATEGIES.JSON, // or 'xml', 'regex'
  strategyOptions: { schema: userSchema },
  llmHandler: myLlmHandler,
  maxRetries: 2,
});

// 4. Run the validation
async function main() {
  const result = await validator.validate("Generate a user profile as a JSON object.");

  if (result.success) {
    console.log('✅ Validation successful!');
    console.log('Data:', result.data);
    console.log(`Attempts: ${result.attempts}`);
  } else {
    console.error('❌ Validation failed after all retries.');
    console.error(result.error.message);
  }
}

main();
```

### Expected Output

The script will first receive an invalid response, trigger the repair loop, and succeed on the second attempt.

```
LLM received prompt: Generate a user profile as a JSON object.
LLM received prompt: The previous response you provided was not in the correct format. Please correct it and try again.

Your task is to respond ONLY with the corrected output, without any additional commentary, apologies, or explanations.

Original Prompt:
---
Generate a user profile as a JSON object.
---

Your Invalid Response:
---
{ "name": "Jane Doe", email: "jane.doe@example.com" }
---

The validation error was:
---
Invalid JSON: The response could not be parsed. Error: Unexpected token e in JSON at position 23
---

Please provide the corrected response that adheres to the required format.
✅ Validation successful!
Data: { name: 'Jane Doe', email: 'jane.doe@example.com' }
Attempts: 2
```

## Examples

### 1. XML Well-Formedness

This example ensures the LLM output is valid XML. No schema is required; it only checks for correct syntax.

```javascript
import { createValidator, STRATEGIES } from 'ai-response-validator';

async function llmThatGeneratesXml(prompt) {
  if (prompt.includes('corrected response')) {
    return '<user><id>123</id><name>John</name></user>';
  }
  return '<user><id>123</id><name>John</user'; // Missing closing tag
}

const xmlValidator = createValidator({
  type: STRATEGIES.XML,
  llmHandler: llmThatGeneratesXml,
});

const result = await xmlValidator.validate("Generate user data in XML format.");

if (result.success) {
  console.log('Valid XML received:', result.data);
} else {
  console.error('Failed to get valid XML:', result.error.message);
}
```

### 2. Regex Pattern Matching

This example validates that the LLM's output is a string matching a specific date format.

```javascript
import { createValidator, STRATEGIES } from 'ai-response-validator';

async function llmThatGeneratesDates(prompt) {
  if (prompt.includes('corrected response')) {
    return '2024-07-26';
  }
  return 'July 26, 2024'; // Incorrect format
}

const dateValidator = createValidator({
  type: STRATEGIES.REGEX,
  strategyOptions: {
    pattern: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  },
  llmHandler: llmThatGeneratesDates,
});

const result = await dateValidator.validate("What is today's date in YYYY-MM-DD format?");

if (result.success) {
  // result.data is the regex match array
  console.log('Valid date received:', result.data[0]);
} else {
  console.error('Failed to get a valid date format:', result.error.message);
}
```

### 3. Handling Streaming Responses

The library automatically aggregates streaming responses before validation. Your `llmHandler` can return any `ReadableStream`.

```javascript
import { createValidator, STRATEGIES } from 'ai-response-validator';
import { Readable } from 'node:stream';

// Simulate a streaming LLM response
async function streamingLlmHandler(prompt) {
  const responseChunks = ['{', '"user":', ' "Alice"', ',', '"status": "active"', '}'];
  return Readable.from(responseChunks);
}

const jsonValidator = createValidator({
  type: STRATEGIES.JSON,
  strategyOptions: {
    schema: {
      type: 'object',
      properties: { user: { type: 'string' }, status: { type: 'string' } },
    },
  },
  llmHandler: streamingLlmHandler,
});

const result = await jsonValidator.validate("Get user status.");

if (result.success) {
  console.log('Successfully validated streaming response:', result.data);
  // rawResponse contains the fully aggregated string
  console.log('Aggregated Raw Response:', result.metadata.rawResponse);
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.