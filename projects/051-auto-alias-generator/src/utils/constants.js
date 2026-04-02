import path from 'node:path';
import os from 'node:os';

/**
 * @fileoverview Exports constants used throughout the Auto Alias Generator application.
 * This includes default configuration values, file paths, and lists for filtering commands.
 * Centralizing these values makes the application easier to configure and maintain.
 */

/**
 * Default history file paths for common shells.
 * The application will attempt to find a history file in this order.
 * Uses `os.homedir()` to construct absolute paths.
 * @type {Record<string, string>}
 */
export const HISTORY_FILE_PATHS = {
  zsh: path.join(os.homedir(), '.zsh_history'),
  bash: path.join(os.homedir(), '.bash_history'),
  fish: path.join(os.homedir(), '.local', 'share', 'fish', 'fish_history'),
};

/**
 * Default configuration values for the CLI.
 * These can be overridden by command-line arguments.
 */
export const DEFAULT_CONFIG = {
  /**
   * The number of recent commands to scan from the history file.
   * A higher number provides more accurate frequency counts but takes longer to process.
   * @type {number}
   */
  limit: 1000,

  /**
   * The minimum number of times a command must appear to be considered for an alias.
   * Helps filter out one-off or rarely used commands.
   * @type {number}
   */
  minFrequency: 5,

  /**
   * The desired length for generated aliases.
   * Shorter aliases are faster to type but have a higher chance of conflicts.
   * @type {number}
   */
  aliasLength: 2,

  /**
   * The number of top command suggestions to display to the user.
   * @type {number}
   */
  numSuggestions: 10,
};

/**
 * A set of common, simple, or potentially sensitive commands to exclude from aliasing.
 * - Single-word commands (e.g., 'ls', 'cd') are often short enough.
 * - Destructive commands ('rm', 'sudo') are excluded for safety.
 * - Shell built-ins and control flow ('exit', 'source') are also ignored.
 * Using a Set provides efficient O(1) average time complexity for lookups.
 * @type {Set<string>}
 */
export const DEFAULT_EXCLUSIONS = new Set([
  // Navigation & File System
  'ls',
  'cd',
  'pwd',
  'cp',
  'mv',
  'rm',
  'mkdir',
  'touch',
  'cat',
  'less',
  'more',
  'head',
  'tail',
  'grep',
  'find',
  'clear',

  // System & Process Management
  'ps',
  'kill',
  'top',
  'htop',
  'df',
  'du',
  'free',
  'sudo', // Safety: avoid aliasing sudo to prevent accidental privileged commands

  // Version Control (base commands)
  'git',
  'svn',
  'hg',

  // Networking
  'ping',
  'ssh',
  'scp',
  'curl',
  'wget',

  // Shell Built-ins & Control
  'exit',
  'source',
  'export',
  'alias',
  'unalias',
  'history',
  'fg',
  'bg',
  'jobs',

  // Common Tools
  'npm',
  'node',
  'yarn',
  'pnpm',
  'bun',
  'docker',
  'vim',
  'nvim',
  'emacs',
  'code', // VS Code CLI
]);

/**
 * The name of the CLI tool, used in help messages and output.
 * @type {string}
 */
export const APP_NAME = 'auto-alias';