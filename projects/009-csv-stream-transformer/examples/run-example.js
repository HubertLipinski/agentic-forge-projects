/**
 * @file examples/run-example.js
 * @description A script demonstrating how to use the csv-stream-transformer library programmatically.
 * This example sets up a transformation using in-memory streams and a custom transformer function,
 * showcasing the flexibility of the API beyond just file-based operations.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { Readable } from 'node:stream';
import { Writable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformCsv } from '../src/index.js';

// --- Helper to get the directory name in ES modules ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A custom value transformer function to demonstrate extensibility.
 * This function takes a full name and splits it into a first name.
 *
 * @param {string} fullName - The input value, expected to be a full name string.
 * @returns {string} The first name part of the full name.
 */
const getFirstName = (fullName) => {
  if (typeof fullName !== 'string' || !fullName.includes(' ')) {
    return fullName; // Return as-is if not a string or no space found
  }
  return fullName.split(' ')[0];
};

/**
 * A simple in-memory writable stream to capture the output.
 * In a real application, this could be a file stream, a database connection,
 * or a stream to another service.
 */
class MemoryWriter extends Writable {
  constructor(options) {
    super(options);
    this.chunks = [];
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  getContent() {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

/**
 * Main function to set up and run the programmatic example.
 */
async function runProgrammaticExample() {
  console.log('🚀 Running programmatic CSV transformation example...');

  // --- 1. Define Source Data ---
  // In a real-world scenario, this could be a file stream, an HTTP response, etc.
  // We use `Readable.from` to easily create a stream from an array of strings.
  const sourceData = [
    'id,name,email,role,last_login\n',
    '1,John Doe,john.doe@example.com,admin,2023-01-15T10:00:00Z\n',
    '2,Jane Smith,jane.smith@example.com,editor,2023-01-16T12:30:00Z\n',
    '3,Peter Jones,,user,2023-01-17T08:45:00Z\n', // Empty email
    '4,Inactive User,inactive@example.com,user,2022-11-20T05:00:00Z\n', // Old login
  ];
  const sourceStream = Readable.from(sourceData);

  // --- 2. Define Transformation Configuration ---
  // This configuration is provided as an object directly, instead of from a file.
  const configObject = {
    // We don't need csvParseOptions here, but we could add them:
    // csvParseOptions: { columns: true },
    mapping: [
      { from: 'id', to: 'userId' },
      {
        from: 'name',
        to: 'firstName',
        transform: [{ name: 'getFirstName' }], // Using our custom transformer
      },
      {
        from: 'email',
        transform: [
          { name: 'toLowerCase' },
          { name: 'default', params: ['N/A'] }, // Provide a default for empty emails
        ],
      },
      { from: 'role', to: 'accessLevel' },
    ],
    // Note: We are not specifying a filter, so all rows will be processed.
  };

  // --- 3. Define Custom Transformers ---
  // The key 'getFirstName' must match the name used in the config's transform array.
  const customTransformers = {
    getFirstName: getFirstName,
  };

  // --- 4. Set up Destination Stream ---
  // We'll write the output to an in-memory stream to inspect the result.
  const destinationStream = new MemoryWriter();

  try {
    // --- 5. Run the Transformation ---
    // The `transformCsv` function orchestrates the entire pipeline.
    await transformCsv({
      source: sourceStream,
      destination: destinationStream,
      config: configObject,
      customTransformers: customTransformers,
    });

    console.log('✅ Transformation completed successfully.');
    console.log('\n--- Transformed CSV Output ---');
    console.log(destinationStream.getContent());
    console.log('----------------------------\n');
  } catch (error) {
    console.error('❌ An error occurred during the transformation:', error);
    // For debugging, log the underlying cause if available
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

/**
 * A second example demonstrating file-to-file transformation using a JSON config file.
 */
async function runFileBasedExample() {
  console.log('🚀 Running file-based CSV transformation example...');

  // --- 1. Define File Paths ---
  // For this example, we'll create a dummy input file.
  const inputFilePath = path.join(__dirname, 'input-complex.csv');
  const outputFilePath = path.join(__dirname, 'output-complex.tsv');
  const configFilePath = path.join(__dirname, 'config', 'complex-transform.json');

  // --- 2. Create a dummy input CSV file ---
  // In a real scenario, this file would already exist.
  const fs = await import('node:fs/promises');
  const dummyCsvContent =
    'user_id,first_name,last_name,email_address,balance,status,is_deleted,registration_date,notes\n' +
    '1,  John  ,  Doe  ,JOHN.DOE@example.com,$150.50,active,false,2023-01-10,\n' +
    '2,Jane,Smith,jane.smith@example.com,$200,active,false,2023-02-15,Has an open ticket\n' +
    '3,Inactive,User,inactive@example.com,$0,inactive,false,2022-05-20,\n' +
    '4,Deleted,Account,deleted@example.com,$50,active,true,2021-11-11,To be removed\n' +
    '5,Peter,Jones,peter.jones@example.com,$99.99,active,false,2023-03-01,\n';

  await fs.writeFile(inputFilePath, dummyCsvContent);
  console.log(`- Created dummy input file: ${inputFilePath}`);

  try {
    // --- 3. Run the Transformation ---
    await transformCsv({
      source: inputFilePath,
      destination: outputFilePath,
      config: configFilePath,
    });

    console.log('✅ File transformation completed successfully.');
    console.log(`- Transformed data written to: ${outputFilePath}`);

    // --- 4. Read and display the output for verification ---
    const result = await fs.readFile(outputFilePath, 'utf-8');
    console.log('\n--- Transformed File Content (output-complex.tsv) ---');
    console.log(result);
    console.log('-----------------------------------------------------\n');

  } catch (error) {
    console.error('❌ An error occurred during the file-based transformation:', error);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  } finally {
    // --- 5. Clean up the created files ---
    try {
      await fs.unlink(inputFilePath);
      await fs.unlink(outputFilePath);
      console.log('- Cleaned up temporary files.');
    } catch (cleanupError) {
      console.error('⚠️ Failed to clean up temporary files:', cleanupError);
    }
  }
}

// Run both examples sequentially.
(async () => {
  await runProgrammaticExample();
  await runFileBasedExample();
})();