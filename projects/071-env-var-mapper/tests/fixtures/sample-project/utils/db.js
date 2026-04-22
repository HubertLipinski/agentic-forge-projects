/**
 * @file tests/fixtures/sample-project/utils/db.js
 * @description A sample file for testing recursive directory scanning and environment variable parsing.
 * This file simulates a database connection module that uses environment variables.
 */

// A simple database connection configuration object.
// This demonstrates accessing multiple environment variables in a typical configuration setup.
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || '5432',
  user: process.env['DB_USER'], // Using bracket notation with a string literal
  password: process.env['DB_PASSWORD'], // Another one
  database: process.env.DB_NAME,
};

// This variable is intentionally left unused to test that the scanner still picks it up.
const unusedVar = process.env.DB_SSL_MODE;

/**
 * A mock function to simulate connecting to the database.
 * It logs the configuration, which includes the environment variables.
 */
export async function connectToDatabase() {
  console.log('Attempting to connect to the database with the following configuration:');
  // We use a copy to avoid logging sensitive information like the password in a real app.
  // For this test fixture, it's fine to log it.
  const displayConfig = { ...dbConfig };
  console.log(displayConfig);

  // This is a dynamic access pattern that the scanner should correctly IGNORE.
  // It's included to ensure the tool doesn't produce false positives.
  const dynamicKey = 'DB_USER';
  console.log(`Dynamically accessed user (should be ignored by scanner): ${process.env[dynamicKey]}`);

  // A duplicate reference to an already used variable. The scanner should report this
  // as another occurrence but not as a new unique variable.
  if (process.env.DB_HOST === 'localhost') {
    console.log('Connecting to a local database instance.');
  }

  return { success: true, message: `Connected to ${dbConfig.database}` };
}

// A comment containing `process.env.SHOULD_BE_IGNORED` to test that the parser
// correctly ignores environment variables found only in comments.

/*
  Another comment block with a variable:
  process.env['ALSO_IGNORED']
*/