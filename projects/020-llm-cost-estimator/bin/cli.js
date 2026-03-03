#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The command-line interface for the LLM Cost Estimator.
 * This script uses 'yargs' to parse command-line arguments and provides a quick
 * way to estimate LLM API call costs from the terminal.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { estimateCost } from '../src/estimator.js';
import { listAllModels } from '../src/pricing/models.js';

/**
 * Formats a number as a USD currency string with a specified number of decimal places.
 * It aims for a balance between precision and readability.
 *
 * @param {number} amount - The dollar amount.
 * @returns {string} The formatted currency string (e.g., "$0.000150").
 */
function formatCurrency(amount) {
  if (amount === 0) {
    return '$0.00';
  }
  // For very small amounts, show more precision.
  if (amount < 0.01) {
    return `$${amount.toFixed(8)}`;
  }
  // For larger amounts, standard currency format is fine.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

/**
 * The main asynchronous function that executes the CLI logic.
 * It parses arguments, calls the cost estimator, and prints the results.
 */
async function main() {
  const allModels = listAllModels();
  const modelChoices = allModels.map(m => m.model);
  const providerChoices = [...new Set(allModels.map(m => m.provider))];

  const argv = await yargs(hideBin(process.argv))
    .scriptName('llm-cost')
    .usage('Usage: $0 <command> [options]')
    .command(
      '$0 <model>',
      'Estimate the cost for a given LLM model and token counts.',
      (y) => {
        y.positional('model', {
          describe: 'The model identifier to estimate cost for (e.g., "gpt-4o")',
          type: 'string',
          choices: modelChoices,
          demandOption: true,
        });
      }
    )
    .option('provider', {
      alias: 'p',
      describe: 'The provider of the model (e.g., "openai"). Inferred from model if not provided.',
      type: 'string',
      choices: providerChoices,
    })
    .option('input-tokens', {
      alias: 'i',
      describe: 'Number of input (prompt) tokens.',
      type: 'number',
      default: 0,
    })
    .option('output-tokens', {
      alias: 'o',
      describe: 'Number of output (completion) tokens.',
      type: 'number',
      default: 0,
    })
    .option('input-text', {
      describe: 'Input text to estimate tokens from (overridden by --input-tokens).',
      type: 'string',
    })
    .option('output-text', {
      describe: 'Output text to estimate tokens from (overridden by --output-tokens).',
      type: 'string',
    })
    .option('force-refresh', {
      alias: 'f',
      describe: 'Force a refresh of pricing data, bypassing the cache.',
      type: 'boolean',
      default: false,
    })
    .demandOption(['model'], 'Please specify a model to estimate costs.')
    .check((argv) => {
      if (
        argv.inputTokens === 0 &&
        argv.outputTokens === 0 &&
        !argv.inputText &&
        !argv.outputText
      ) {
        throw new Error('You must provide token counts (--input-tokens, --output-tokens) or text (--input-text, --output-text).');
      }
      return true;
    })
    .alias('h', 'help')
    .alias('v', 'version')
    .epilogue('For more information, visit the project repository.')
    .strict()
    .parse();

  try {
    // Find the provider for the selected model
    const selectedModelInfo = allModels.find(m => m.model === argv.model);
    if (!selectedModelInfo) {
      // This case should ideally be caught by yargs `choices`, but serves as a safeguard.
      console.error(`Error: Model '${argv.model}' is not a supported model.`);
      process.exit(1);
    }
    const provider = argv.provider ?? selectedModelInfo.provider;

    const tokens = {
      inputTokens: argv.inputTokens > 0 ? argv.inputTokens : undefined,
      outputTokens: argv.outputTokens > 0 ? argv.outputTokens : undefined,
      inputText: argv.inputText,
      outputText: argv.outputText,
    };

    const options = {
      force: argv.forceRefresh,
    };

    const result = await estimateCost(provider, argv.model, tokens, options);

    // --- Display Results ---
    console.log(`\nCost Estimation for: ${result.provider}/${result.model}`);
    console.log('--------------------------------------------------');
    console.log(`  Input Tokens:  ${result.inputTokens.toLocaleString()}`);
    console.log(`  Output Tokens: ${result.outputTokens.toLocaleString()}`);
    console.log('--------------------------------------------------');
    console.log(`  Input Cost:    ${formatCurrency(result.inputCost)}`);
    console.log(`  Output Cost:   ${formatCurrency(result.outputCost)}`);
    console.log('--------------------------------------------------');
    console.log(`  Total Cost:    ${formatCurrency(result.totalCost)}`);
    console.log('--------------------------------------------------');
    console.log(`Pricing used: $${result.pricing.input.toFixed(2)}/1M input, $${result.pricing.output.toFixed(2)}/1M output tokens.`);

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch((error) => {
  console.error('\nAn unexpected error occurred:');
  console.error(error);
  process.exit(1);
});