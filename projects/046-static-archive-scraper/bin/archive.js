#!/usr/bin/env node

/**
 * @file bin/archive.js
 * @description The executable command-line interface (CLI) for the Static Archive Scraper.
 *
 * This script uses 'yargs' to parse command-line arguments, provides user-friendly
 * help and validation, and then initiates the website crawling process by calling
 * the main `crawlWebsite` function with the provided configuration.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { crawlWebsite } from '../src/core/crawler.js';

// Get the name from package.json for consistent branding in help messages.
// This is a robust way to avoid hardcoding the script name.
const SCRIPT_NAME = 'static-archive';

/**
 * Main asynchronous function to set up and run the CLI.
 * This encapsulates the entire CLI logic, allowing for clean async/await usage
 * and top-level error handling.
 */
async function main() {
  // Configure yargs for parsing command-line arguments.
  const argv = await yargs(hideBin(process.argv))
    .scriptName(SCRIPT_NAME)
    .usage(`Usage: $0 <url> [options]`)
    .command('$0 <url>', 'Scrape a static website for offline viewing', (yargs) => {
      yargs.positional('url', {
        describe: 'The starting URL of the website to archive',
        type: 'string',
      });
    })
    .option('output', {
      alias: 'o',
      describe: 'Directory to save the archived website',
      type: 'string',
      default: './archive',
      normalize: true, // Automatically resolves the path (e.g., 'foo/../bar' -> 'bar')
    })
    .option('depth', {
      alias: 'd',
      describe: 'Maximum crawl depth for links',
      type: 'number',
      default: 3,
    })
    .option('user-agent', {
      alias: 'U',
      describe: 'User-Agent string for HTTP requests',
      type: 'string',
      default: 'StaticArchiveScraper/1.0 (+https://github.com/your-username/static-archive-scraper)',
    })
    .check((argv) => {
      // Custom validation for arguments.
      if (!argv.url) {
        throw new Error('The <url> argument is required.');
      }
      try {
        // eslint-disable-next-line no-new
        new URL(argv.url);
      } catch (error) {
        throw new Error('Invalid URL provided. Please include the protocol (e.g., "https://example.com").');
      }
      if (argv.depth < 0) {
        throw new Error('The --depth must be a non-negative number.');
      }
      return true; // Indicates validation passed
    })
    .alias('h', 'help')
    .alias('v', 'version')
    .epilogue(`For more information, visit the project repository at:\nhttps://github.com/your-username/static-archive-scraper`)
    .help()
    .strict() // Throws an error for unknown options
    .parse();

  // Prepare options for the crawler from the parsed arguments.
  const options = {
    startUrl: argv.url,
    outputDir: path.resolve(process.cwd(), argv.output), // Ensure output is an absolute path
    maxDepth: argv.depth,
    userAgent: argv.userAgent,
  };

  // Announce the start of the process with key configuration details.
  console.log('--- Static Archive Scraper ---');
  console.log(`> Target URL: ${options.startUrl}`);
  console.log(`> Output Directory: ${options.outputDir}`);
  console.log(`> Max Crawl Depth: ${options.maxDepth}`);
  console.log('------------------------------\n');

  try {
    // Initiate the crawl. The `crawlWebsite` function handles the core logic.
    await crawlWebsite(options);
    console.log('\n✅ Archive complete!');
    console.log(`Website saved to: ${options.outputDir}`);
  } catch (error) {
    // Catch any unhandled exceptions from the crawler and provide a final error message.
    console.error('\n❌ An unexpected error occurred during the archiving process.');
    console.error(`Error: ${error.message}`);
    // Exit with a non-zero status code to indicate failure, which is important for scripting.
    process.exit(1);
  }
}

// Execute the main function.
main();