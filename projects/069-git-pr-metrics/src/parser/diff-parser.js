/**
 * @file src/parser/diff-parser.js
 * @description Parses the output of `git diff --stat` to extract the number of lines added and deleted for a given PR.
 */

/**
 * Parses the summary line from `git diff --stat` output to extract change counts.
 *
 * The summary line typically looks like one of these:
 * - "1 file changed, 5 insertions(+), 3 deletions(-)"
 * - "2 files changed, 10 insertions(+)"
 * - "1 file changed, 8 deletions(-)"
 *
 * This function is designed to be robust and handle all these variations.
 *
 * @param {string} diffStatOutput The raw string output from `git diff --stat`.
 * @returns {{additions: number, deletions: number, filesChanged: number}} An object containing the total number of additions, deletions, and files changed. Returns all zeros if the input is empty or doesn't match the expected format.
 * @throws {Error} If the input `diffStatOutput` is not a string.
 */
export function parseDiffStat(diffStatOutput) {
  if (typeof diffStatOutput !== 'string') {
    throw new Error('Invalid input: diffStatOutput must be a string.');
  }

  const trimmedOutput = diffStatOutput.trim();
  if (!trimmedOutput) {
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }

  // The summary line is always the last line of the `git diff --stat` output.
  const summaryLine = trimmedOutput.split('\n').pop() ?? '';

  // Regex to find numbers associated with "file(s) changed", "insertion(s)", and "deletion(s)".
  // It uses optional non-capturing groups `(?: ... )?` to handle cases where
  // insertions or deletions are not present.
  const filesChangedMatch = summaryLine.match(/(\d+)\s+file/);
  const insertionsMatch = summaryLine.match(/(\d+)\s+insertion/);
  const deletionsMatch = summaryLine.match(/(\d+)\s+deletion/);

  // Use nullish coalescing operator `??` to default to 0 if a match is not found.
  // `parseInt` is used to convert the captured string digit to a number.
  const filesChanged = parseInt(filesChangedMatch?.[1] ?? '0', 10);
  const additions = parseInt(insertionsMatch?.[1] ?? '0', 10);
  const deletions = parseInt(deletionsMatch?.[1] ?? '0', 10);

  return {
    additions,
    deletions,
    filesChanged,
  };
}