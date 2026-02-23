/**
 * @file examples/basic-usage.js
 * @description Demonstrates how to use the md-front-matter-json package as a library.
 *
 * This script showcases the programmatic API by:
 * 1. Creating temporary example markdown files.
 * 2. Using `convertFile` to process a single file.
 * 3. Using `convertDirectory` to process multiple files in a directory.
 * 4. Handling potential errors gracefully.
 * 5. Cleaning up the temporary files and directory.
 *
 * To run this example:
 * `node examples/basic-usage.js`
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertFile, convertDirectory } from '../src/index.js';

// --- Helper functions for creating a temporary test environment ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp-content');

const exampleFiles = {
  'post-1.md': `---
title: "First Post"
author: "Alice"
tags: ["intro", "node"]
published: true
---

# Welcome to the first post!

This is the body of the first markdown file.`,

  'post-2.md': `---
title: "Second Post"
author: "Bob"
tags: ["update", "javascript"]
published: false
---

# Exploring a new topic

Content for the second post goes here.`,

  'about.md': `# About Us

This page has no front-matter. It's just plain markdown.`,
};

/**
 * Creates a temporary directory and populates it with example markdown files.
 */
async function setupExampleContent() {
  console.log(`Setting up temporary directory at: ${TEMP_DIR}\n`);
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    for (const [fileName, content] of Object.entries(exampleFiles)) {
      await fs.writeFile(path.join(TEMP_DIR, fileName), content, 'utf8');
    }
  } catch (error) {
    console.error('Error setting up example content:', error);
    throw error; // Propagate error to stop execution
  }
}

/**
 * Removes the temporary directory and its contents.
 */
async function cleanup() {
  console.log(`\nCleaning up temporary directory: ${TEMP_DIR}`);
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Main demonstration function.
 */
async function main() {
  await setupExampleContent();

  try {
    // --- 1. Example: Convert a single file ---
    console.log('--- 1. Converting a single file ---');
    const singleFilePath = path.join(TEMP_DIR, 'post-1.md');
    const singleFileResult = await convertFile(singleFilePath);

    console.log('Result from convertFile("post-1.md"):');
    console.log(JSON.stringify(singleFileResult, null, 2));
    console.log('\n');

    // --- 2. Example: Convert a file with no front-matter ---
    console.log('--- 2. Converting a file with no front-matter ---');
    const noFrontMatterPath = path.join(TEMP_DIR, 'about.md');
    const noFrontMatterResult = await convertFile(noFrontMatterPath);

    console.log('Result from convertFile("about.md"):');
    console.log(JSON.stringify(noFrontMatterResult, null, 2));
    console.log('\n');

    // --- 3. Example: Convert an entire directory ---
    console.log('--- 3. Converting an entire directory ---');
    const directoryResult = await convertDirectory(TEMP_DIR);

    console.log(`Result from convertDirectory("${path.basename(TEMP_DIR)}"):`);
    console.log(JSON.stringify(directoryResult, null, 2));
    console.log('\n');

    // --- 4. Example: Handling a non-existent file ---
    console.log('--- 4. Handling a non-existent file (expecting an error) ---');
    try {
      await convertFile(path.join(TEMP_DIR, 'non-existent.md'));
    } catch (error) {
      console.log('Successfully caught expected error:');
      console.error(`  Message: ${error.message}`);
    }

  } catch (error) {
    // Catch any unexpected errors from the conversion functions
    console.error('\n[FATAL] An unexpected error occurred during the demonstration:');
    console.error(error);
  } finally {
    // Ensure cleanup runs even if errors occur
    await cleanup();
  }
}

// Run the main function
main();