/**
 * @file examples/sample-project/task1.js
 * @description An example JavaScript task script for daily data fetching and processing.
 * This script demonstrates how to define a scheduled job using a declarative cron comment.
 * The `declarative-cron-parser` tool will detect this comment and add it to the system's crontab.
 */

// @cron: 0 5 * * * /usr/local/bin/node /path/to/your/project/examples/sample-project/task1.js --source=api
// @cron: 30 5 * * * /usr/local/bin/node /path/to/your/project/examples/sample-project/task1.js --source=db

import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ES module equivalent of __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * A mock function to simulate fetching data from an external API.
 * In a real-world scenario, this would make an HTTP request using `fetch` or a library like `axios`.
 * @returns {Promise<object>} A promise that resolves to the fetched data.
 */
async function fetchDataFromApi() {
  console.log('Fetching data from external API...');
  // Simulate a network request
  await new Promise(resolve => setTimeout(resolve, 500));
  const data = {
    id: `api_${Date.now()}`,
    type: 'API_DATA',
    payload: {
      users: Math.floor(Math.random() * 1000),
      revenue: Math.random() * 5000,
    },
    timestamp: new Date().toISOString(),
  };
  console.log('Data fetched successfully from API.');
  return data;
}

/**
 * A mock function to simulate fetching data from a database.
 * @returns {Promise<object>} A promise that resolves to the fetched data.
 */
async function fetchDataFromDatabase() {
  console.log('Fetching data from database...');
  // Simulate a DB query
  await new Promise(resolve => setTimeout(resolve, 300));
  const data = {
    id: `db_${Date.now()}`,
    type: 'DB_DATA',
    payload: {
      orders: Math.floor(Math.random() * 50),
      inventory: Math.floor(Math.random() * 10000),
    },
    timestamp: new Date().toISOString(),
  };
  console.log('Data fetched successfully from database.');
  return data;
}

/**
 * Writes the processed data to a log file.
 * @param {object} data - The data to write.
 * @param {string} source - The source of the data (e.g., 'api', 'db').
 */
async function writeDataLog(data, source) {
  const logFilePath = join(__dirname, `${source}-data.log`);
  const logEntry = `${JSON.stringify(data)}\n`;

  try {
    const writableStream = createWriteStream(logFilePath, { flags: 'a' });
    await pipeline(
      [logEntry],
      writableStream
    );
    console.log(`Successfully wrote data to ${logFilePath}`);
  } catch (error) {
    console.error(`Error writing to log file ${logFilePath}:`, error);
    throw error; // Re-throw to ensure the script exits with an error code
  }
}

/**
 * Main execution function for the script.
 * It parses command-line arguments to determine the data source and runs the task.
 */
async function main() {
  console.log(`\nStarting task run at: ${new Date().toISOString()}`);
  const args = process.argv.slice(2);
  const sourceArg = args.find(arg => arg.startsWith('--source='));

  if (!sourceArg) {
    console.error('Error: Missing required argument --source=<api|db>');
    process.exit(1);
  }

  const source = sourceArg.split('=')[1];
  let data;

  try {
    switch (source) {
      case 'api':
        data = await fetchDataFromApi();
        break;
      case 'db':
        data = await fetchDataFromDatabase();
        break;
      default:
        console.error(`Error: Invalid source "${source}". Must be "api" or "db".`);
        process.exit(1);
    }

    await writeDataLog(data, source);
    console.log('Task completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('An unexpected error occurred during the task:', error.message);
    process.exit(1);
  }
}

// The check `import.meta.url === ...` ensures this code only runs when the file is executed directly.
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Export functions for potential testing or programmatic use.
export { fetchDataFromApi, fetchDataFromDatabase, writeDataLog };