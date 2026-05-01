'use strict';

/**
 * @fileoverview Defines constants used throughout the structured-config-loader library.
 * This includes source priority levels and default search paths for configuration files.
 * Centralizing these constants ensures consistency and simplifies maintenance.
 *
 * @module src/constants
 */

/**
 * Defines the priority order for merging configuration sources.
 * Higher numbers indicate higher priority, meaning they will override sources with lower numbers.
 * This explicit ordering is the core of the library's deterministic merging logic.
 *
 * The order is designed to follow a standard, intuitive hierarchy:
 * 1. **Default**: Lowest priority, intended for default values baked into the application.
 * 2. **File**: Base configuration from files like `config.json` or `config.yaml`.
 * 3. **Environment**: Overrides from environment variables, suitable for containerized deployments.
 * 4. **Arguments**: Highest priority, allowing for explicit, one-off overrides from the command line.
 *
 * @type {Readonly<object>}
 * @property {number} DEFAULT - Priority for default configuration objects.
 * @property {number} FILE - Priority for configuration loaded from files.
 * @property {number} ENV - Priority for configuration from environment variables.
 * @property {number} ARGV - Priority for configuration from command-line arguments.
 */
export const SOURCE_PRIORITY = Object.freeze({
  DEFAULT: 100,
  FILE: 200,
  ENV: 300,
  ARGV: 400,
});

/**
 * An array of default file basenames that the loader will search for if no explicit
 * file paths are provided. The search is performed in the application's current working directory.
 *
 * The order reflects a common configuration pattern:
 * - `config.json` / `config.yaml`: Base configuration, often checked into version control.
 * - `config.local.json` / `config.local.yaml`: Local overrides, typically ignored by version control.
 *
 * The loader will attempt to load files in this specific order, merging them sequentially.
 *
 * @type {Readonly<string[]>}
 */
export const DEFAULT_CONFIG_FILES = Object.freeze([
  'config.json',
  'config.yaml',
  'config.yml',
  'config.local.json',
  'config.local.yaml',
  'config.local.yml',
]);

/**
 * The default path for a `.env` file.
 * This is the standard location that tools like `dotenv` search for by default.
 *
 * @type {Readonly<string>}
 */
export const DEFAULT_ENV_FILE = Object.freeze('.env');