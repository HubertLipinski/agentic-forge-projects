/**
 * @file src/changelog/generator.js
 * @description Generates a formatted changelog string from a list of commits.
 * This module follows the principles of Keep a Changelog.
 */

/**
 * @typedef {import('../commits/parser.js').ConventionalCommit} ConventionalCommit
 */

/**
 * A map of conventional commit types to their display headers in the changelog.
 * This provides a clear, human-readable section for each type of change.
 * The order of keys determines the order of sections in the generated changelog.
 * @type {Map<string, string>}
 */
const COMMIT_TYPE_TO_HEADER = new Map([
  ['feat', '### ✨ Features'],
  ['fix', '### 🐛 Bug Fixes'],
  ['perf', '### 🚀 Performance Improvements'],
  ['revert', '### ⏪ Reverts'],
  ['docs', '### 📚 Documentation'],
  ['style', '### 🎨 Styles'],
  ['refactor', '### ♻️ Code Refactoring'],
  ['test', '### ✅ Tests'],
  ['build', '### 📦 Build System'],
  ['ci', '### 🤖 Continuous Integration'],
]);

/**
 * Formats a single commit into a changelog line item.
 * The format is typically: `- subject (scope)`.
 *
 * @param {ConventionalCommit} commit - The parsed conventional commit object.
 * @returns {string} A formatted string for a single changelog entry.
 */
function formatCommitLine(commit) {
  const scope = commit.scope ? `**${commit.scope}**: ` : '';
  // Ensure the subject doesn't have a trailing period for consistency.
  const subject = commit.subject?.trim().replace(/\.$/, '');
  return `- ${scope}${subject}`;
}

/**
 * Generates a formatted changelog string for a new version from a list of commits.
 *
 * The changelog includes:
 * - A main heading with the new version and release date.
 * - A dedicated section for breaking changes.
 * - Grouped sections for different commit types (features, fixes, etc.).
 *
 * @param {string} newVersion - The new version string (e.g., '1.2.3').
 * @param {ConventionalCommit[]} commits - An array of parsed conventional commits for this release.
 * @returns {string} The formatted changelog content as a markdown string.
 */
export function generateChangelog(newVersion, commits) {
  if (!newVersion || typeof newVersion !== 'string') {
    throw new Error('A valid new version string must be provided to generate the changelog.');
  }

  if (!Array.isArray(commits) || commits.length === 0) {
    return `## ${newVersion} (${new Date().toISOString().split('T')[0]})\n\nNo significant changes in this version.`;
  }

  const sections = new Map();
  const breakingChanges = [];

  // Group commits by their type and collect breaking changes
  for (const commit of commits) {
    // 1. Collect Breaking Changes from commit notes
    if (commit.notes?.length > 0) {
      for (const note of commit.notes) {
        if (note.title.toUpperCase().includes('BREAKING CHANGE')) {
          // Format the breaking change message, using the note text.
          const scope = commit.scope ? `**${commit.scope}**: ` : '';
          breakingChanges.push(`- ${scope}${note.text.trim()}`);
        }
      }
    }

    // 2. Group regular commits by type
    const commitType = commit.type?.toLowerCase();
    if (commitType) {
      if (!sections.has(commitType)) {
        sections.set(commitType, []);
      }
      sections.get(commitType)?.push(formatCommitLine(commit));
    }
  }

  // Build the changelog string
  const today = new Date().toISOString().split('T')[0];
  let changelogContent = `## ${newVersion} (${today})\n\n`;

  // Add Breaking Changes section if any exist
  if (breakingChanges.length > 0) {
    changelogContent += '### 🚨 BREAKING CHANGES\n';
    changelogContent += breakingChanges.join('\n') + '\n\n';
  }

  // Add sections for each commit type based on the predefined order
  for (const [type, header] of COMMIT_TYPE_TO_HEADER.entries()) {
    if (sections.has(type)) {
      changelogContent += `${header}\n`;
      changelogContent += sections.get(type).join('\n') + '\n\n';
    }
  }

  // Append any other commit types that are not in the standard map
  for (const [type, lines] of sections.entries()) {
    if (!COMMIT_TYPE_TO_HEADER.has(type)) {
      // Create a generic header for unknown types
      const header = `### ${type.charAt(0).toUpperCase() + type.slice(1)}`;
      changelogContent += `${header}\n`;
      changelogContent += lines.join('\n') + '\n\n';
    }
  }

  return changelogContent.trim();
}