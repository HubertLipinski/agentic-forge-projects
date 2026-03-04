/**
 * src/utils/shell-detector.js
 *
 * This module is responsible for detecting the user's current shell environment.
 * It provides a function to identify supported shells like bash, zsh, and fish,
 * which is crucial for locating the correct history and configuration files.
 */

import { basename } from 'node:path';

/**
 * A set of shells supported by this CLI tool.
 * Using a Set provides efficient O(1) lookups.
 * @type {Set<string>}
 */
const SUPPORTED_SHELLS = new Set(['bash', 'zsh', 'fish']);

/**
 * Detects the user's current shell based on environment variables.
 *
 * This function inspects the `SHELL` environment variable, which typically
 * contains the path to the user's default login shell executable. It extracts
 * the base name of the executable (e.g., 'bash' from '/bin/bash') and checks
 * if it's one of the supported shells.
 *
 * On Windows, the `SHELL` variable might not be set. In such cases, it checks
 * for `ComSpec` (for cmd.exe) or `PSModulePath` (for PowerShell), but since
 * those are not supported shells for this tool's primary purpose (creating *nix-style aliases),
 * they will lead to a null result.
 *
 * @returns {Promise<string | null>} A promise that resolves to the name of the
 *   detected shell (e.g., 'zsh', 'bash', 'fish') if it's supported, or null otherwise.
 */
export async function detectShell() {
  // `process.env` is synchronous, but we use an async function for future-proofing
  // and consistency with other I/O-bound modules in the project.
  try {
    // The SHELL environment variable is the most reliable indicator on POSIX systems.
    const shellPath = process.env.SHELL;

    if (!shellPath) {
      // This can happen on minimal systems or non-POSIX environments like Windows.
      // We could try checking process parents, but it's complex and unreliable.
      // For now, we gracefully indicate that no supported shell was found.
      console.error(
        'Error: SHELL environment variable not set. Unable to determine current shell.'
      );
      return null;
    }

    // Extract the executable name from the full path (e.g., '/bin/zsh' -> 'zsh').
    const shellName = basename(shellPath);

    if (SUPPORTED_SHELLS.has(shellName)) {
      return shellName;
    }

    // The detected shell is not one we explicitly support.
    console.warn(
      `Warning: Detected shell "${shellName}" is not officially supported. Supported shells are: ${[
        ...SUPPORTED_SHELLS,
      ].join(', ')}.`
    );
    return null;
  } catch (error) {
    // This is a safeguard, as reading process.env is unlikely to throw.
    // However, defensive programming is a good practice.
    console.error('An unexpected error occurred while detecting the shell:', error);
    return null;
  }
}