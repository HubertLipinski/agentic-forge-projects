/**
 * @file src/seeder.js
 * @description The core logic orchestrator. It uses the file processor, validator,
 * and a database client to perform the seeding operation.
 */

import logger from './utils/logger.js';
import { processPath } from './file-processor.js';
import { getValidator, validateRecord } from './validator.js';

/**
 * @typedef {object} SeederOptions
 * @property {string} path - Path to the JSON file or directory.
 * @property {import('./clients/base-client.js').default} client - An instance of a database client.
 * @property {boolean} [dryRun=false] - If true, simulate the run without writing to the database.
 * @property {string} [schemaPath] - Optional path to a JSON schema for validation.
 */

/**
 * Validates a set of records against a schema.
 *
 * @param {object[]} records - The array of data records to validate.
 * @param {import('ajv').ValidateFunction} validateFn - The compiled Ajv validation function.
 * @returns {object[]} The array of records that passed validation.
 */
function validateRecords(records, validateFn) {
  const validRecords = [];
  let invalidCount = 0;

  for (const record of records) {
    if (validateRecord(record, validateFn)) {
      validRecords.push(record);
    } else {
      invalidCount++;
    }
  }

  if (invalidCount > 0) {
    logger.warn(`${invalidCount} out of ${records.length} records failed validation and will be skipped.`);
  }

  return validRecords;
}

/**
 * Orchestrates the database seeding process.
 *
 * This function performs the following steps:
 * 1. Processes the input path to get a list of JSON files and their content.
 * 2. If a schema path is provided, it loads and compiles the schema validator.
 * 3. Iterates through each file's data.
 * 4. (Optional) Validates each record against the schema.
 * 5. Inserts the valid data into the database using the provided client.
 * 6. Handles dry-run mode by logging actions without performing database writes.
 * 7. Logs progress and summary statistics.
 *
 * @param {SeederOptions} options - The configuration options for the seeder.
 * @returns {Promise<void>} A promise that resolves when the seeding process is complete.
 */
export async function runSeeder({ path, client, dryRun = false, schemaPath }) {
  logger.info('Starting JSON file seeder...');
  if (dryRun) {
    logger.warn('DRY RUN mode enabled. No data will be written to the database.');
  }

  let validateFn = null;
  if (schemaPath) {
    logger.info('Schema validation enabled.');
    validateFn = await getValidator(schemaPath);
    if (!validateFn) {
      // Error is already logged by getValidator. Stop the process.
      throw new Error('Seeding process aborted due to schema loading failure.');
    }
  }

  const fileContents = await processPath(path);
  if (fileContents.length === 0) {
    logger.info('No data to seed. Process finished.');
    return;
  }

  let totalFilesProcessed = 0;
  let totalRecordsInserted = 0;

  for (const { filePath, target, data } of fileContents) {
    logger.info(`Processing file: ${filePath}`);

    let recordsToInsert = Array.isArray(data) ? data : [data];
    const initialRecordCount = recordsToInsert.length;

    if (initialRecordCount === 0) {
      logger.warn(`File is empty or contains an empty array. Skipping.`);
      continue;
    }

    // Perform validation if a validator function is available
    if (validateFn) {
      logger.info(`Validating ${initialRecordCount} record(s) for target '${target}'...`);
      recordsToInsert = validateRecords(recordsToInsert, validateFn);
    }

    const validRecordCount = recordsToInsert.length;
    if (validRecordCount === 0) {
      logger.warn(`No valid records to insert for target '${target}' after validation. Skipping file.`);
      continue;
    }

    if (dryRun) {
      logger.info(`[DRY RUN] Would insert ${validRecordCount} record(s) into target '${target}'.`);
      totalRecordsInserted += validRecordCount;
    } else {
      try {
        logger.info(`Inserting ${validRecordCount} record(s) into target '${target}'...`);
        const insertedCount = await client.insert(target, recordsToInsert);
        logger.info(`Successfully inserted ${insertedCount} record(s) into '${target}'.`);
        totalRecordsInserted += insertedCount;
      } catch (error) {
        // The client-specific error message is more detailed.
        logger.error(`Error seeding data from ${filePath} into '${target}'.`);
        // Re-throw to halt the entire process on insertion failure.
        throw error;
      }
    }
    totalFilesProcessed++;
  }

  logger.info('--------------------');
  logger.info('Seeding Summary:');
  logger.info(`- Files processed: ${totalFilesProcessed}`);
  logger.info(`- Total records ${dryRun ? 'to be inserted' : 'inserted'}: ${totalRecordsInserted}`);
  logger.info('--------------------');
  logger.info('Seeding process completed successfully.');
}