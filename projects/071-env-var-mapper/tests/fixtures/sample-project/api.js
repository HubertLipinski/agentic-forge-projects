/**
 * @file tests/fixtures/sample-project/api.js
 * @description A sample file for testing environment variable parsing.
 * This file contains various access patterns for `process.env` to ensure
 * the scanner correctly identifies them.
 */

// Import from another fixture file to simulate a real project structure.
import { connectToDatabase } from './utils/db.js';

// --- Standard Member Expression Access ---
// The most common way to access environment variables.
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

// --- Computed Member Expression Access (with string literals) ---
// Another valid static access pattern that should be detected.
const PORT = process.env['PORT'] || 3000;
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

// --- Dynamic/Computed Access (that should be IGNORED) ---
// The parser should be smart enough to skip these, as the variable name is not static.
function getDynamicConfig(key) {
  // This is a dynamic key, so it cannot be statically determined.
  return process.env[key];
}
const DYNAMIC_VALUE = getDynamicConfig('SOME_RUNTIME_VAR');

// --- A variable that is not `process.env` ---
// This is to ensure the parser doesn't accidentally match other objects.
const myEnv = { 'NOT_AN_ENV_VAR': 'hello' };
const notAnEnvVar = myEnv.NOT_AN_ENV_VAR;

// --- A duplicate variable access ---
// The tool should report this as a second occurrence of `PORT`.
function startServer() {
  const serverPort = process.env.PORT || 8080;
  console.log(`Server is starting on port ${serverPort}`);
  // A duplicate access using a different notation.
  console.log(`The environment is set to: ${process.env['NODE_ENV']}`);
}

// --- A variable with a weird name (should still be valid) ---
const WEIRD_VAR_NAME = process.env.VAR_WITH_UNDERSCORES_AND_NUMBERS_123;

// --- A variable inside a complex expression ---
const useHttps = (process.env.ENABLE_HTTPS === 'true');

// --- A variable that is part of a string but not an access ---
const someString = "This is just a string, not process.env.IGNORED_VAR";

// --- A variable with an empty string literal (should be IGNORED) ---
const emptyVar = process.env[''];

/**
 * A mock API handler function.
 */
export async function handleApiRequest() {
  if (!API_KEY || !API_SECRET) {
    throw new Error('API credentials are not configured. Please set API_KEY and API_SECRET.');
  }

  // Simulate connecting to the DB, which uses its own set of env vars.
  await connectToDatabase();

  startServer();

  return {
    status: 'success',
    environment: NODE_ENV,
    httpsEnabled: useHttps,
    dynamicValue: DYNAMIC_VALUE, // This will be undefined as it's not a real env var
    notAnEnvVar,
    someString,
    weirdVar: WEIRD_VAR_NAME,
    emptyVar,
  };
}