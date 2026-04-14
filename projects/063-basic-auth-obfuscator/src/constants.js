/**
 * @file src/constants.js
 * @description Defines shared constants for the Basic Auth Obfuscator.
 *
 * This file centralizes configuration values used across the application,
 * particularly for the cryptographic operations in `core.js`. By keeping these
 * values in one place, we ensure consistency and make future updates easier.
 */

/**
 * The symmetric encryption algorithm to be used.
 * AES-256-GCM is chosen for its strong security and built-in authentication,
 * which protects against tampering (integrity) and provides confidentiality.
 * It's a modern, widely-recommended standard for authenticated encryption.
 * @type {string}
 */
export const ALGORITHM = 'aes-256-gcm';

/**
 * The length of the Initialization Vector (IV) in bytes.
 * For AES-GCM, a 12-byte (96-bit) IV is recommended by NIST for performance
 * and security. A unique IV must be used for every encryption with the same key.
 * @type {number}
 */
export const IV_LENGTH = 12;

/**
 * The length of the GCM authentication tag in bytes.
 * The authentication tag is crucial for verifying the integrity and authenticity
 * of the encrypted data. A 16-byte (128-bit) tag provides the highest level of
 * authentication strength for AES-GCM.
 * @type {number}
 */
export const AUTH_TAG_LENGTH = 16;

/**
 * The required length of the secret key in bytes.
 * For AES-256, the key must be 256 bits, which is 32 bytes.
 * This constant is used to validate the user-provided secret key.
 * @type {number}
 */
export const KEY_LENGTH = 32;

/**
 * The character encoding used for converting strings to bytes and back.
 * UTF-8 is the standard for web and modern applications, supporting a wide
 * range of characters.
 * @type {string}
 */
export const ENCODING = 'utf8';

/**
 * The name of the environment variable used to supply the secret key.
 * This provides a non-interactive way to set the secret, which is essential
 * for use in CI/CD pipelines and other automated environments.
 * @type {string}
 */
export const SECRET_KEY_ENV_VAR = 'BASIC_AUTH_OBFUSCATOR_KEY';