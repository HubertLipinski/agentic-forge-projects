/**
 * @file examples/runtime-usage.js
 * @description Demonstrates how to use the 'basic-auth-obfuscator' library at runtime.
 *
 * This example simulates a Node.js application that needs to make an authenticated
 * API request. It retrieves an encrypted token and a secret key from environment
 * variables, uses the `decrypt` function to get the plaintext "user:pass" credentials,
 * and then uses these credentials to make an HTTP request with a Basic Auth header.
 *
 * To run this example:
 * 1. Generate an encrypted token using the CLI:
 *    `node bin/cli.js encrypt "my-user:my-super-secret-password" --secret "my-decryption-key"`
 *
 * 2. Run this script with the generated token and the secret key in environment variables:
 *    `ENCRYPTED_API_CREDS="<paste-the-token-here>" DECRYPTION_KEY="my-decryption-key" node examples/runtime-usage.js`
 */

// Use the local project's `decrypt` function. In a real project, you would
// import from the installed package: `import { decrypt } from 'basic-auth-obfuscator';`
import { decrypt } from '../src/index.js';

// We'll use a simple mock server to simulate a protected API endpoint.
import { createServer } from 'node:http';

const MOCK_API_PORT = 8080;
const MOCK_API_HOST = 'localhost';
const CORRECT_CREDENTIALS = 'my-user:my-super-secret-password';

/**
 * Creates and starts a simple mock HTTP server.
 * This server listens for requests and checks for a valid Basic Auth header.
 * It responds with a 200 OK for correct credentials and a 401 Unauthorized otherwise.
 * @returns {Promise<import('node:http').Server>} A promise that resolves with the server instance once it's listening.
 */
function startMockApiServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      console.log(`[Mock API] Received request for: ${req.url}`);

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.log('[Mock API] ❌ No Basic Auth header found. Responding with 401.');
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protected Area"' });
        res.end('Unauthorized: Missing Basic Authentication credentials.');
        return;
      }

      const encodedCreds = authHeader.split(' ')[1];
      const decodedCreds = Buffer.from(encodedCreds, 'base64').toString('utf8');

      console.log(`[Mock API] Received credentials: "${decodedCreds}"`);

      if (decodedCreds === CORRECT_CREDENTIALS) {
        console.log('[Mock API] ✅ Credentials are correct. Responding with 200.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Access granted!', user: decodedCreds.split(':')[0] }));
      } else {
        console.log('[Mock API] ❌ Incorrect credentials. Responding with 401.');
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protected Area"' });
        res.end('Unauthorized: Invalid credentials.');
      }
    });

    server.listen(MOCK_API_PORT, MOCK_API_HOST, () => {
      console.log(`[Mock API] Server running at http://${MOCK_API_HOST}:${MOCK_API_PORT}/\n`);
      resolve(server);
    });
  });
}

/**
 * Main application logic.
 * Retrieves secrets, decrypts them, and makes an authenticated API call.
 */
async function main() {
  console.log('--- Basic Auth Obfuscator Runtime Usage Example ---');

  // 1. Start the mock API server for our demonstration.
  const server = await startMockApiServer();

  // 2. Retrieve the encrypted token and the secret key from environment variables.
  //    This is the standard, secure way to provide secrets to an application.
  const encryptedToken = process.env.ENCRYPTED_API_CREDS;
  const secretKey = process.env.DECRYPTION_KEY;

  if (!encryptedToken || !secretKey) {
    console.error('\n❌ Error: Missing required environment variables.');
    console.error('Please set ENCRYPTED_API_CREDS and DECRYPTION_KEY.');
    console.error('\nExample:');
    console.error('  ENCRYPTED_API_CREDS="<token>" DECRYPTION_KEY="<key>" node examples/runtime-usage.js\n');
    server.close();
    process.exit(1);
  }

  console.log('Found encrypted token in environment variables.');

  let credentials;
  try {
    // 3. Decrypt the token to get the plaintext "user:pass" string.
    //    This is the core library function.
    console.log('Attempting to decrypt token...');
    credentials = await decrypt(encryptedToken, secretKey);
    console.log('✅ Decryption successful!\n');
  } catch (error) {
    console.error('\n❌ Fatal Error: Failed to decrypt credentials.');
    console.error(`   Reason: ${error.message}`);
    console.error('   Please ensure the token and secret key are correct.\n');
    server.close();
    process.exit(1);
  }

  // 4. Use the decrypted credentials to make an authenticated request.
  try {
    console.log('Making authenticated request to the mock API...');

    // Encode the "user:pass" string to Base64 for the Authorization header.
    const basicAuthHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

    const response = await fetch(`http://${MOCK_API_HOST}:${MOCK_API_PORT}/data`, {
      headers: {
        'Authorization': basicAuthHeader,
      },
    });

    const responseBody = await response.json();
    console.log('\n--- API Response ---');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Body:', responseBody);
    console.log('--------------------\n');

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    console.log('🎉 Successfully demonstrated runtime decryption and API authentication!');
  } catch (error) {
    console.error(`\n❌ Error during API request: ${error.message}`);
  } finally {
    // 5. Clean up by closing the server.
    server.close(() => {
      console.log('\n[Mock API] Server has been shut down.');
    });
  }
}

// Run the main application logic.
main().catch((err) => {
  console.error('An unexpected error occurred in the main function:', err);
  process.exit(1);
});