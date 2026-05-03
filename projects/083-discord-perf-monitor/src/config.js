/**
 * @file src/config.js
 * @description Handles loading and validating bot configuration from environment variables.
 *
 * This module is responsible for safely loading all necessary configuration
 * from the environment. It uses the `dotenv` package to load a `.env` file
 * during development, but is fully compatible with standard environment variables
 * in production environments (e.g., Docker, Kubernetes).
 *
 * It performs validation on each required variable, ensuring that the application
 * starts with a sane and complete configuration. If any critical variable is
 * missing or invalid, the application will exit with a descriptive error message,
 * preventing it from running in a broken state.
 */

import 'dotenv/config'; // Loads .env file into process.env. Must be the first import.

/**
 * A centralized error class for configuration-related issues.
 * This helps in distinguishing configuration errors from other runtime errors.
 */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Retrieves and validates a required environment variable.
 * Throws a ConfigError if the variable is missing or empty.
 *
 * @param {string} name - The name of the environment variable (e.g., 'BOT_TOKEN').
 * @returns {string} The value of the environment variable.
 * @throws {ConfigError} If the environment variable is not set.
 */
function getRequired(name) {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Retrieves and validates an optional environment variable, providing a default value.
 *
 * @param {string} name - The name of the environment variable.
 * @param {string | number} defaultValue - The default value to use if the variable is not set.
 * @returns {string} The value of the environment variable or the default value.
 */
function getOptional(name, defaultValue) {
  return process.env[name] ?? String(defaultValue);
}

/**
 * Retrieves and validates an integer environment variable.
 *
 * @param {string} name - The name of the environment variable.
 * @param {number} defaultValue - The default value to use if the variable is not set or is invalid.
 * @returns {number} The parsed integer value.
 * @throws {ConfigError} If the value is present but not a valid integer.
 */
function getInteger(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || String(parsed) !== value) {
    throw new ConfigError(`Invalid integer value for environment variable ${name}: "${value}"`);
  }
  return parsed;
}

/**
 * Main configuration object.
 *
 * This object is populated by reading and validating environment variables.
 * It is frozen to prevent accidental modification at runtime, ensuring that
 * the configuration remains immutable throughout the application's lifecycle.
 */
const config = {
  /**
   * The Discord bot's authentication token.
   * Required for connecting to the Discord API.
   * @type {string}
   */
  discordToken: getRequired('DISCORD_TOKEN'),

  /**
   * The Discord User ID of the bot's owner.
   * Used for privileged commands or direct error reporting.
   * @type {string}
   */
  ownerId: getRequired('DISCORD_OWNER_ID'),

  /**
   * The TCP port on which the Prometheus metrics server will listen.
   * Defaults to 9091.
   * @type {number}
   */
  metricsPort: getInteger('METRICS_PORT', 9091),

  /**
   * The channel ID where unhandled exceptions and promise rejections will be reported.
   * This is optional. If not provided, errors will only be logged to the console.
   * @type {string | null}
   */
  errorLogChannelId: getOptional('ERROR_LOG_CHANNEL_ID', null),

  /**
   * The environment the application is running in.
   * Typically 'development' or 'production'. Defaults to 'development'.
   * @type {string}
   */
  nodeEnv: getOptional('NODE_ENV', 'development'),
};

// Validate specific config values for correctness.
if (!/^\d{17,20}$/.test(config.ownerId)) {
  throw new ConfigError(`Invalid DISCORD_OWNER_ID: "${config.ownerId}". Must be a valid Discord Snowflake ID.`);
}

if (config.errorLogChannelId && !/^\d{17,20}$/.test(config.errorLogChannelId)) {
  throw new ConfigError(`Invalid ERROR_LOG_CHANNEL_ID: "${config.errorLogChannelId}". Must be a valid Discord Snowflake ID.`);
}

if (config.metricsPort <= 0 || config.metricsPort > 65535) {
  throw new ConfigError(`Invalid METRICS_PORT: ${config.metricsPort}. Must be between 1 and 65535.`);
}

// Freeze the configuration object to make it immutable.
// This is a best practice to prevent runtime changes to configuration.
Object.freeze(config);

export default config;