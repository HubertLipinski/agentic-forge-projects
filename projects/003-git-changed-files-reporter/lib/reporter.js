import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Executes a Git command and returns its stdout.
 * @param {string} command - The Git command to execute.
 * @returns {Promise<string>} A promise that resolves with the stdout of the command.
 * @throws {Error} If the command execution fails.
 */
async function executeGitCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      // Git commands often output to stderr even on success (e.g., warnings).
      // We'll log it but not necessarily throw unless it's a critical error.
      console.warn(`Git stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to execute Git command "${command}": ${error.message}`);
  }
}

/**
 * Gets the list of changed files between the current HEAD and a specified reference.
 * @param {string} reference - The Git reference (commit, tag, or branch) to compare against.
 * @returns {Promise<string[]>} A promise that resolves with an array of changed file paths.
 */
async function getChangedFiles(reference) {
  const command = `git diff --name-only ${reference}...HEAD`;
  const output = await executeGitCommand(command);
  return output ? output.split('\n') : [];
}

/**
 * Gets the list of untracked files in the repository.
 * @returns {Promise<string[]>} A promise that resolves with an array of untracked file paths.
 */
async function getUntrackedFiles() {
  const command = 'git ls-files --others --exclude-standard';
  const output = await executeGitCommand(command);
  return output ? output.split('\n') : [];
}

/**
 * Filters a list of file paths by their extension.
 * @param {string[]} files - An array of file paths.
 * @param {string} extension - The file extension to filter by (e.g., 'js', '.ts').
 * @returns {string[]} An array of file paths that match the given extension.
 */
function filterFilesByExtension(files, extension) {
  if (!extension) {
    return files;
  }
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return files.filter(file => file.endsWith(normalizedExtension));
}

/**
 * Reports on changed and/or untracked files in a Git repository.
 * @param {object} options - Configuration options for the reporter.
 * @param {string} [options.reference='HEAD~1'] - The Git reference to compare against. Defaults to the previous commit.
 * @param {string} [options.filterExtension] - Filter changes by file extension (e.g., 'js').
 * @param {boolean} [options.includeUntracked=false] - Whether to include untracked files in the report.
 * @returns {Promise<string[]>} A promise that resolves with an array of file paths to report.
 * @throws {Error} If Git commands fail or if no changes are found and the exit code should be non-zero.
 */
export async function reportChangedFiles(options = {}) {
  const {
    reference = 'HEAD~1',
    filterExtension,
    includeUntracked = false,
  } = options;

  let changedFiles = [];
  try {
    changedFiles = await getChangedFiles(reference);
  } catch (error) {
    // If the reference is invalid or HEAD~1 doesn't exist (e.g., empty repo),
    // we might get an error. For an empty repo, no changes is expected.
    // If the reference is explicitly provided and invalid, it's a real error.
    if (reference === 'HEAD~1' && error.message.includes('bad revision')) {
      console.warn(`Could not get changes relative to ${reference}. This might be an empty repository or a very new commit. Proceeding without changes.`);
      changedFiles = [];
    } else {
      throw error; // Re-throw other errors
    }
  }


  let untrackedFiles = [];
  if (includeUntracked) {
    try {
      untrackedFiles = await getUntrackedFiles();
    } catch (error) {
      throw new Error(`Failed to get untracked files: ${error.message}`);
    }
  }

  let allFiles = [...changedFiles, ...untrackedFiles];

  if (filterExtension) {
    allFiles = filterFilesByExtension(allFiles, filterExtension);
  }

  // Remove duplicates that might arise if an untracked file has the same name as a changed file
  allFiles = [...new Set(allFiles)];

  return allFiles;
}