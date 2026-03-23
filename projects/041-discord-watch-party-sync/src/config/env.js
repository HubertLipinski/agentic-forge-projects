import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {object} AppConfig
 * @property {string} DISCORD_TOKEN - The bot's token from the Discord Developer Portal.
 * @property {string} CLIENT_ID - The bot's client ID from the Discord Developer Portal.
 * @property {string} GUILD_ID - The ID of the development server for testing commands.
 * @property {string} LOG_LEVEL - The minimum level for logging (e.g., 'info', 'debug').
 */

/**
 * Loads and validates environment variables.
 *
 * This function uses `dotenv` to load variables from a `.env` file located in the project root.
 * It then validates the presence of critical variables required for the bot's operation.
 * If any required variable is missing, it throws a comprehensive error and exits the process.
 *
 * @returns {AppConfig} A frozen object containing the validated environment variables.
 * @throws {Error} If any required environment variables are missing.
 */
function loadAndValidateEnv() {
  // Determine the project root directory to locate the .env file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..', '..');

  const result = dotenv.config({ path: path.join(projectRoot, '.env') });

  if (result.error) {
    // In production, we might expect env vars to be set directly,
    // so we only log a warning if the .env file is not found.
    console.warn(
      `[WARN] Could not find .env file at project root. ` +
      `Ensure environment variables are set externally. Error: ${result.error.message}`
    );
  }

  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    // GUILD_ID is often only for development/testing, but we'll treat it as required
    // for simplicity in command deployment. For a multi-guild bot, this could be optional.
    'GUILD_ID',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please create a .env file in the project root and add them.`
    );
  }

  const config = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    // Provide a sensible default for LOG_LEVEL
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  };

  // Freeze the config object to prevent accidental mutations during runtime.
  // This is a good practice for configuration data.
  return Object.freeze(config);
}

/**
 * A frozen configuration object containing validated environment variables.
 * Call `loadAndValidateEnv()` at the start of the application to populate this.
 *
 * @type {AppConfig}
 */
const env = loadAndValidateEnv();

export default env;