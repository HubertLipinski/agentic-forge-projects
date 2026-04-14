# Basic Auth Obfuscator

[![npm version](https://img.shields.io/npm/v/basic-auth-obfuscator.svg)](https://www.npmjs.com/package/basic-auth-obfuscator)
[![Node.js CI](https://img.shields.io/github/actions/workflow/status/your-username/basic-auth-obfuscator/ci.yml?branch=main)](https://github.com/your-username/basic-auth-obfuscator/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool and library for securing HTTP Basic Authentication credentials in configuration files and environment variables. It encrypts `user:pass` strings into a single, opaque token that can be decrypted at runtime, preventing plaintext credential exposure in source control or logs.

Ideal for developers and DevOps engineers who need a simple, zero-dependency way to manage basic auth secrets.

## Features

-   **Strong Encryption**: Uses AES-256-GCM symmetric encryption from Node.js's native `crypto` module.
-   **Opaque Token**: Generates a single, URL-safe base64-encoded token from a `user:pass` string and a secret key.
-   **Simple CLI**: Easy-to-use `encrypt` and `decrypt` commands for managing credentials.
-   **Runtime Decryption**: A lightweight library function for decrypting tokens within your Node.js application.
-   **Secure Secret Handling**: Interactive CLI prompts for secret keys to avoid shell history exposure.
-   **CI/CD Friendly**: Supports providing the secret key via an environment variable (`BASIC_AUTH_OBFUSCATOR_KEY`).
-   **Zero Dependencies**: The core decryption library has zero production npm dependencies, keeping your application lean.

## Installation

You can install the tool globally to use the CLI anywhere on your system.

```bash
npm install -g basic-auth-obfuscator
```

Alternatively, you can use it directly without a global installation via `npx`:

```bash
npx basic-auth-obfuscator encrypt "user:pass"
```

To use the library in your project:

```bash
npm install basic-auth-obfuscator
```

## Usage

The package provides both a command-line interface (`auth-obfuscator`) and a library function (`decrypt`).

### CLI

The primary use case is to encrypt credentials for storage in configuration or environment variables.

#### `encrypt` command

Encrypts a `username:password` string.

```bash
auth-obfuscator encrypt <credentials> [options]
```

-   `<credentials>`: The "user:pass" string to encrypt.
-   `--secret, -s`: The secret key for encryption. If omitted, the tool will check for the `BASIC_AUTH_OBFUSCATOR_KEY` environment variable or prompt you to enter it securely.

#### `decrypt` command

Decrypts a token to verify its contents.

```bash
auth-obfuscator decrypt <token> [options]
```

-   `<token>`: The encrypted token to decrypt.
-   `--secret, -s`: The secret key for decryption.

### Library (Runtime Decryption)

Use the `decrypt` function in your Node.js application to decode a token at runtime.

```javascript
import { decrypt } from 'basic-auth-obfuscator';

const encryptedToken = process.env.API_CREDS_TOKEN;
const secretKey = process.env.DECRYPTION_KEY;

async function getCredentials() {
  try {
    const credentials = await decrypt(encryptedToken, secretKey);
    // credentials -> "my-user:p@ssw0rd123"
    const [user, pass] = credentials.split(':');
    return { user, pass };
  } catch (error) {
    console.error('Failed to decrypt credentials:', error.message);
    // Handle error appropriately
    process.exit(1);
  }
}
```

## Examples

### 1. Encrypting Credentials Interactively

This is the most secure way to encrypt on your local machine, as the secret key will not be saved in your shell history.

```bash
$ auth-obfuscator encrypt "admin:S3cur3P@ssw0rd!"

Yellow: Secret key not provided via --secret flag or environment variable.
Cyan: Enter secret key for encryption: ****

✓ Encryption Successful!

Generated Token:
eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSm9obiBEb2UifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

Store this token in your configuration or environment variables.
```

### 2. Encrypting with a Secret from an Environment Variable

This method is ideal for use in CI/CD pipelines or other automated scripts.

```bash
# Set the environment variable
export BASIC_AUTH_OBFUSCATOR_KEY="a-very-strong-and-long-secret-key"

# Run the encrypt command
$ auth-obfuscator encrypt "api-user:another-secret"

dim: Using secret from BASIC_AUTH_OBFUSCATOR_KEY environment variable.

✓ Encryption Successful!

Generated Token:
...
```

### 3. Runtime Decryption in an Application

Here is a complete example showing how to use the decrypted credentials to make an authenticated request.

```javascript
// file: my-app.js
import { decrypt } from 'basic-auth-obfuscator';
import http from 'node:http';

const encryptedToken = process.env.API_TOKEN; // Get token from environment
const secretKey = process.env.DECRYPTION_KEY; // Get key from environment

async function makeApiCall() {
  if (!encryptedToken || !secretKey) {
    throw new Error('API_TOKEN and DECRYPTION_KEY must be set.');
  }

  // 1. Decrypt the token to get "user:pass"
  const credentials = await decrypt(encryptedToken, secretKey);

  // 2. Create the Basic Auth header
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

  // 3. Make the request
  const options = {
    hostname: 'api.example.com',
    path: '/v1/data',
    headers: {
      'Authorization': authHeader,
    },
  };

  http.get(options, (res) => {
    console.log(`API response status: ${res.statusCode}`);
    // ... process response
  }).on('error', (e) => {
    console.error(`API request error: ${e.message}`);
  });
}

makeApiCall().catch(console.error);
```

To run the above example:

```bash
# First, encrypt your credentials
$ export DECRYPTION_KEY="my-app-secret-key"
$ export API_TOKEN=$(npx auth-obfuscator encrypt "user:pass" --secret "$DECRYPTION_KEY")

# Now, run your application
$ node my-app.js
API response status: 200
```

## Security Considerations

-   **Secret Key Management**: The security of your encrypted credentials depends entirely on the secrecy of your decryption key. Treat the key as you would any other production secret. Store it securely in your CI/CD environment, a secret manager (like HashiCorp Vault, AWS Secrets Manager), or as a protected environment variable on your server.
-   **Algorithm**: This tool uses `AES-256-GCM`, a modern authenticated encryption algorithm. It not only encrypts the data but also protects it from being tampered with. Any modification to the encrypted token will cause the decryption to fail.
-   **Key Derivation**: The provided secret is passed through `scrypt`, a key derivation function (KDF), to generate the actual encryption key. This adds significant resistance to brute-force attacks on the secret key.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/my-new-feature`).
3.  Commit your changes (`git commit -am 'Add some feature'`).
4.  Push to the branch (`git push origin feature/my-new-feature`).
5.  Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.