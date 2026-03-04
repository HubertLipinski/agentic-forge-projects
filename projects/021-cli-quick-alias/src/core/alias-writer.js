/**
 * src/core/alias-writer.js
 *
 * This module handles the final step of the alias creation process: formatting
 * the alias string and appending it to the user's shell configuration file.
 * It includes safeguards like checking for pre-existing aliases and a dry-run
 * mode for user safety.
 */

import { promises as fs } from 'node:fs';
import { EOL } from 'node:os';

/**
 * A standardized header for the aliases added by this tool. This helps users
 * identify which aliases were managed by `quick-alias` in their config files.
 * @type {string}
 */
const ALIAS_BLOCK_HEADER = `# Aliases created by CLI Quick Alias`;

/**
 * Generates a complete, multi-line alias string ready for writing to a config file.
 *
 * This function constructs the alias definition along with a descriptive comment
 * that includes the creation date and the original command. This metadata is
 * invaluable for future reference and maintenance.
 *
 * @param {string} aliasName - The name for the new alias (e.g., 'gs').
 * @param {string} originalCommand - The full command the alias will execute (e.g., 'git status').
 * @param {function(string, string): string} aliasFormatFn - The shell-specific function
 *   to format the `alias name='command'` string.
 * @returns {string} A formatted string block containing the comment and the alias definition.
 *
 * @example
 * // Returns:
 * // # Added by quick-alias on 2023-10-27. Original: git status --short
 * // alias gs='git status --short'
 * formatAliasString('gs', 'git status --short', (name, cmd) => `alias ${name}='${cmd}'`);
 */
function formatAliasString(aliasName, originalCommand, aliasFormatFn) {
  const creationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const comment = `# Added by quick-alias on ${creationDate}. Original: ${originalCommand}`;
  const aliasDefinition = aliasFormatFn(aliasName, originalCommand);

  return `${comment}${EOL}${aliasDefinition}`;
}

/**
 * Checks if a given alias name already exists in the shell configuration file.
 *
 * This function reads the config file and uses a regular expression to look for
 * existing alias definitions for the given name. This prevents accidentally
 * overwriting a user's existing alias. It's designed to be robust enough for
 * common alias definition syntaxes (e.g., `alias gs=...`, `alias gs ...`).
 *
 * @param {string} aliasName - The alias name to check for.
 * @param {string} configFilePath - The path to the shell configuration file.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the alias exists, `false` otherwise.
 */
async function aliasExists(aliasName, configFilePath) {
  try {
    const content = await fs.readFile(configFilePath, 'utf-8');
    // This regex looks for `alias <name>=` or `alias <name> ` at the start of a line,
    // accommodating variations in spacing and syntax (e.g., bash/zsh vs. fish).
    // The `\b` ensures we match whole words only (e.g., `gst` doesn't match `gs`).
    const aliasRegex = new RegExp(`^\\s*alias\\s+${aliasName}(\\s|=)`, 'm');
    return aliasRegex.test(content);
  } catch (error) {
    // If the file doesn't exist yet, no aliases can exist in it.
    if (error.code === 'ENOENT') {
      return false;
    }
    // For other errors (e.g., permissions), we log it and conservatively
    // assume the alias might exist to prevent accidental overwrites.
    console.error(
      `Warning: Could not check for existing alias in "${configFilePath}".`,
      error.message
    );
    return true; // Fail-safe: assume it exists to prevent overwrite.
  }
}

/**
 * Appends the generated alias string to the specified shell configuration file.
 *
 * This is the core I/O function of the module. It handles the "dry-run" logic,
 * checks for pre-existing aliases, and safely appends the new alias block to
 * the end of the configuration file. It also ensures a standard header is present
 * for aliases managed by this tool.
 *
 * @param {object} options - The options for writing the alias.
 * @param {string} options.aliasName - The chosen name for the alias.
 * @param {string} options.command - The original command to be aliased.
 * @param {string} options.configFilePath - The absolute path to the shell config file.
 * @param {function(string, string): string} options.aliasFormatFn - The shell-specific formatting function.
 * @param {boolean} [options.dryRun=false] - If true, prints the alias to the console instead of writing to the file.
 * @returns {Promise<boolean>} A promise that resolves to `true` on success, `false` on failure.
 */
export async function writeAlias({
  aliasName,
  command,
  configFilePath,
  aliasFormatFn,
  dryRun = false,
}) {
  const aliasBlock = formatAliasString(aliasName, command, aliasFormatFn);

  if (dryRun) {
    console.log('\n-- DRY RUN MODE --');
    console.log(`The following content would be appended to "${configFilePath}":\n`);
    console.log(aliasBlock);
    console.log('\nNo files were modified.');
    return true;
  }

  try {
    if (await aliasExists(aliasName, configFilePath)) {
      console.error(
        `Error: An alias named "${aliasName}" already exists in "${configFilePath}".`
      );
      console.error('Please choose a different name or remove the existing alias manually.');
      return false;
    }

    let fileContent = '';
    try {
      fileContent = await fs.readFile(configFilePath, 'utf-8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // File doesn't exist, which is fine. We'll create it.
    }

    let contentToAppend = '';
    // Add the header only if it's not already in the file.
    if (!fileContent.includes(ALIAS_BLOCK_HEADER)) {
      // Add extra newlines for separation if the file is not empty.
      const separator = fileContent.trim().length > 0 ? `${EOL}${EOL}` : '';
      contentToAppend += `${separator}${ALIAS_BLOCK_HEADER}${EOL}`;
    }

    // Ensure there's always a newline before the new alias block.
    contentToAppend += `${EOL}${aliasBlock}${EOL}`;

    await fs.appendFile(configFilePath, contentToAppend, 'utf-8');

    console.log(`✅ Success! Alias "${aliasName}" was added to "${configFilePath}".`);
    console.log('Please restart your shell or run `source ${configFilePath}` to use it.');
    return true;
  } catch (error) {
    console.error(`❌ Error: Failed to write alias to "${configFilePath}".`);
    if (error.code === 'EACCES') {
      console.error('Permission denied. Please check file permissions.');
    } else {
      console.error('An unexpected error occurred:', error.message);
    }
    return false;
  }
}