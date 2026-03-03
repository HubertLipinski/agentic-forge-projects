# llm-cost-estimator

A lightweight JavaScript utility to estimate the cost of API calls to various Large Language Models (LLMs) before sending the request. It helps developers monitor and control their AI expenses by providing cost breakdowns based on token counts and the latest pricing models. Ideal for hobbyists, students, and small teams trying to stay within a budget.

## Features

- **Cost Estimation:** Calculate costs for OpenAI (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo) and Anthropic (Claude 3 family) models.
- **Simple API:** A clean, async function-based API: `estimateCost('openai', 'gpt-4o', { ... })`.
- **Built-in Tokenizer:** Includes a lightweight, pure-JS tokenizer for accurate token counting without heavy dependencies.
- **Auto-Updating Prices:** Automatically fetches and caches the latest pricing data (with fallbacks).
- **CLI Tool:** A powerful command-line interface for quick, on-the-fly cost calculations.
- **Zero Core Dependencies:** The core estimation logic is dependency-free, making it easy to integrate into any project.

## Installation

You can install the package via npm:

```bash
npm install llm-cost-estimator
```

Alternatively, you can clone the repository and install dependencies locally:

```bash
git clone https://github.com/your-username/llm-cost-estimator.git
cd llm-cost-estimator
npm install
```

## Usage

### Command-Line Interface (CLI)

The package includes a handy `llm-cost` command. You can use it to quickly estimate costs from your terminal.

**Basic usage with token counts:**

```bash
llm-cost gpt-4o --input-tokens 10000 --output-tokens 2500
```

**Estimate cost from text files or strings:**

```bash
# Using strings
llm-cost claude-3-haiku-20240307 --input-text "Summarize the history of the internet."

# Using files (on Unix-like systems)
llm-cost gpt-4-turbo --input-text "$(cat prompt.txt)" --output-text "$(cat response.txt)"
```

**Get help and see all options:**

```bash
llm-cost --help
```

### Programmatic API

Import `estimateCost` and other utilities directly into your Node.js project.

```javascript
import { estimateCost, countTokens } from 'llm-cost-estimator';

// Estimate cost using known token counts
const cost = await estimateCost('openai', 'gpt-4o', {
  inputTokens: 10000,
  outputTokens: 5000,
});

console.log(`Total estimated cost: $${cost.totalCost.toFixed(6)}`);

// Estimate cost using raw text
const prompt = 'This is a prompt for the model.';
const response = 'This is the model\'s response.';

const costFromText = await estimateCost('anthropic', 'claude-3-haiku-20240307', {
  inputText: prompt,
  outputText: response,
});

console.log(`Input tokens: ${costFromText.inputTokens}, Output tokens: ${costFromText.outputTokens}`);
console.log(`Total estimated cost: $${costFromText.totalCost.toFixed(6)}`);
```

## Examples

### Example 1: CLI cost for a typical RAG query

Estimate the cost of a query using OpenAI's `gpt-4o` where you provide 15,000 tokens of context and receive a 2,000 token response.

**Command:**

```bash
llm-cost gpt-4o --input-tokens 15000 --output-tokens 2000
```

**Expected Output:**

```
Cost Estimation for: openai/gpt-4o
--------------------------------------------------
  Input Tokens:  15,000
  Output Tokens: 2,000
--------------------------------------------------
  Input Cost:    $0.00007500
  Output Cost:   $0.00003000
--------------------------------------------------
  Total Cost:    $0.00010500
--------------------------------------------------
Pricing used: $5.00/1M input, $15.00/1M output tokens.
```

### Example 2: Programmatic cost for a Claude 3 Haiku chat

Estimate the cost of a short conversation with Anthropic's most affordable model, `claude-3-haiku`, using raw text.

**Code:**

```javascript
import { estimateCost } from 'llm-cost-estimator';

async function calculateHaikuCost() {
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

  try {
    const cost = await estimateCost('anthropic', 'claude-3-haiku-20240307', {
      inputText: prompt,
      outputText: response,
    });
    console.log(cost);
  } catch (error) {
    console.error('Failed to estimate cost:', error);
  }
}

calculateHaikuCost();
```

**Expected Output:**

```json
{
  "totalCost": 0.00002825,
  "inputCost": 0.00001525,
  "outputCost": 0.000013,
  "inputTokens": 61,
  "outputTokens": 26,
  "model": "claude-3-haiku-20240307",
  "provider": "anthropic",
  "pricing": {
    "input": 0.25,
    "output": 1.25
  }
}
```

## Supported Models

| Provider  | Model ID                     | Input Cost (/1M tokens) | Output Cost (/1M tokens) |
| :-------- | :--------------------------- | :---------------------- | :----------------------- |
| `openai`  | `gpt-4o`                     | $5.00                   | $15.00                   |
| `openai`  | `gpt-4-turbo`                | $10.00                  | $30.00                   |
| `openai`  | `gpt-3.5-turbo-0125`         | $0.50                   | $1.50                    |
| `anthropic` | `claude-3-opus-20240229`     | $15.00                  | $75.00                   |
| `anthropic` | `claude-3-sonnet-20240229`   | $3.00                   | $15.00                   |
| `anthropic` | `claude-3-haiku-20240307`    | $0.25                   | $1.25                    |

*Pricing data is fetched and cached but may not be real-time. The values above reflect the static fallback data.*

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.