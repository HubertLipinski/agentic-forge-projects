/**
 * @file src/analysis/blame-parser.js
 * @module analysis/blame-parser
 * @description Parses the machine-readable output of `git blame --porcelain`
 * into a structured JavaScript object representing the blame information for a file.
 */

/**
 * Represents a single line of blame information, linking a line of code to a specific commit.
 *
 * @typedef {object} BlameLine
 * @property {string} hash - The full commit SHA-1 hash.
 * @property {number} originalLine - The line number in the original file version of this commit.
 * @property {number} finalLine - The line number in the final version of the file.
 * @property {number} numLines - The number of lines in the group this line belongs to (usually 1).
 * @property {string} content - The actual content of the line of code.
 * @property {object} commit - The detailed commit information associated with this line.
 */

/**
 * Represents the detailed information for a single commit found in the blame output.
 *
 * @typedef {object} BlameCommit
 * @property {string} hash - The full commit SHA-1 hash.
 * @property {string} author - The name of the commit author.
 * @property {string} 'author-mail' - The email of the commit author.
 * @property {number} 'author-time' - The authoring timestamp (Unix epoch).
 * @property {string} 'author-tz' - The authoring timezone.
 * @property {string} committer - The name of the committer.
 * @property {string} 'committer-mail' - The email of the committer.
 * @property {number} 'committer-time' - The committing timestamp (Unix epoch).
 * @property {string} 'committer-tz' - The committing timezone.
 * @property {string} summary - The first line of the commit message.
 * @property {string} [filename] - The filename in the commit that this line originated from.
 * @property {string} ['previous-hash'] - The SHA of the parent commit and the original filename.
 * @property {boolean} ['boundary'] - Indicates if this is a boundary commit (e.g., the first commit).
 */

/**
 * Represents the fully parsed blame output for a file.
 *
 * @typedef {object} ParsedBlame
 * @property {BlameLine[]} lines - An array of blame information for each line in the file.
 * @property {Map<string, BlameCommit>} commits - A map of unique commits found, keyed by their SHA hash.
 */

/**
 * Parses the machine-readable output from `git blame --porcelain`.
 *
 * The porcelain format consists of two parts for each line of the file:
 * 1. A "header" section describing the commit that last touched the line.
 * 2. The actual line of code, prefixed with a tab character.
 *
 * This function processes the raw string output line by line, building up a
 * structured representation of the blame data.
 *
 * @param {string} porcelainOutput - The raw string output from `git blame --porcelain`.
 * @returns {ParsedBlame} A structured object containing the parsed blame data.
 * @throws {Error} If the input is malformed or cannot be parsed.
 */
export function parsePorcelainBlame(porcelainOutput) {
  if (typeof porcelainOutput !== 'string' || porcelainOutput.trim() === '') {
    // Handle empty or invalid input gracefully. An empty file results in empty output.
    return { lines: [], commits: new Map() };
  }

  const lines = porcelainOutput.split('\n');
  const parsedLines = [];
  const commits = new Map();

  let currentCommitInfo = null;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (!line) {
      // Skip empty lines which can occur at the end of the output.
      lineIndex++;
      continue;
    }

    // A line starting with a hash is the beginning of a new commit header block.
    if (!line.startsWith('\t')) {
      const [hash, originalLine, finalLine, numLines] = line.split(' ');

      // This is the main header line for a line of code.
      // Example: "e9378c5... 2 2 1"
      if (hash.length === 40 && !isNaN(parseInt(originalLine, 10))) {
        currentCommitInfo = {
          hash,
          originalLine: parseInt(originalLine, 10),
          finalLine: parseInt(finalLine, 10),
          numLines: parseInt(numLines, 10) || 1, // numLines might not be present for single-line hunks
        };

        // If this commit hasn't been seen before, create a new entry for it.
        if (!commits.has(hash)) {
          commits.set(hash, { hash });
        }

        lineIndex++; // Move to the next line in the header block.
        continue;
      }

      // This is a subsequent line in the commit header block.
      // Example: "author John Doe"
      if (currentCommitInfo) {
        const [key, ...valueParts] = line.split(' ');
        const value = valueParts.join(' ');
        const commitDetails = commits.get(currentCommitInfo.hash);

        // Store the detail on the commit object in our map.
        // Convert numeric fields to numbers for easier use later.
        switch (key) {
          case 'author-time':
          case 'committer-time':
            commitDetails[key] = parseInt(value, 10);
            break;
          case 'previous':
            // 'previous' line format: "previous <hash> <filename>"
            commitDetails['previous-hash'] = value;
            break;
          case 'boundary':
            commitDetails[key] = true;
            break;
          default:
            commitDetails[key] = value;
            break;
        }

        lineIndex++;
        continue;
      }

      // If we reach here, the line is unexpected.
      throw new Error(`Malformed porcelain blame output. Unexpected line: "${line}" at index ${lineIndex}`);
    }

    // A line starting with a tab is the actual code content.
    // Example: "\tconst x = 1;"
    if (line.startsWith('\t')) {
      if (!currentCommitInfo) {
        throw new Error(`Malformed porcelain blame output. Found content line without a preceding commit header at index ${lineIndex}`);
      }

      const content = line.substring(1);
      const commit = commits.get(currentCommitInfo.hash);

      parsedLines.push({
        hash: currentCommitInfo.hash,
        originalLine: currentCommitInfo.originalLine,
        finalLine: currentCommitInfo.finalLine,
        numLines: currentCommitInfo.numLines,
        content,
        commit, // Reference the shared commit object
      });

      // Reset for the next block.
      currentCommitInfo = null;
      lineIndex++;
    }
  }

  // Final validation: ensure all lines have a corresponding commit.
  if (parsedLines.some(l => !l.commit)) {
    throw new Error('Parsing failed: some lines are missing commit information.');
  }

  return { lines: parsedLines, commits };
}