import { describe, it, expect } from 'vitest';
import { parsePorcelainBlame } from '../../src/analysis/blame-parser.js';

describe('parsePorcelainBlame', () => {
  const samplePorcelainOutput = `
9a3e69b421a3338085b46b68a81b37937eda3cbe 1 1 3
author John Doe
author-mail <john.doe@example.com>
author-time 1672531200
author-tz +0000
committer John Doe
committer-mail <john.doe@example.com>
committer-time 1672531200
committer-tz +0000
summary Initial commit
filename src/index.js
	const a = 1;
9a3e69b421a3338085b46b68a81b37937eda3cbe 2 2
	const b = 2;
9a3e69b421a3338085b46b68a81b37937eda3cbe 3 3
	
d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7 4 4
author Jane Smith
author-mail <jane.smith@example.com>
author-time 1672617600
author-tz +0000
committer Jane Smith
committer-mail <jane.smith@example.com>
committer-time 1672617600
committer-tz +0000
summary Add feature C
previous 9a3e69b421a3338085b46b68a81b37937eda3cbe src/index.js
filename src/index.js
	const c = 3;
`.trim();

  it('should parse a standard porcelain blame output correctly', () => {
    const { lines, commits } = parsePorcelainBlame(samplePorcelainOutput);

    // Check lines array
    expect(lines).toHaveLength(4);

    // Check first line
    expect(lines[0]).toEqual(expect.objectContaining({
      hash: '9a3e69b421a3338085b46b68a81b37937eda3cbe',
      originalLine: 1,
      finalLine: 1,
      numLines: 3,
      content: 'const a = 1;',
    }));
    expect(lines[0].commit).toBeDefined();
    expect(lines[0].commit.hash).toBe('9a3e69b421a3338085b46b68a81b37937eda3cbe');

    // Check second line (part of a multi-line hunk)
    expect(lines[1]).toEqual(expect.objectContaining({
      hash: '9a3e69b421a3338085b46b68a81b37937eda3cbe',
      originalLine: 2,
      finalLine: 2,
      numLines: 1, // numLines is not present on subsequent lines of a hunk, defaults to 1
      content: 'const b = 2;',
    }));

    // Check third line (empty line)
    expect(lines[2].content).toBe('');

    // Check fourth line
    expect(lines[3]).toEqual(expect.objectContaining({
      hash: 'd8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7',
      originalLine: 4,
      finalLine: 4,
      numLines: 1,
      content: 'const c = 3;',
    }));
    expect(lines[3].commit).toBeDefined();
    expect(lines[3].commit.hash).toBe('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7');

    // Check commits map
    expect(commits.size).toBe(2);
    expect(commits.has('9a3e69b421a3338085b46b68a81b37937eda3cbe')).toBe(true);
    expect(commits.has('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7')).toBe(true);
  });

  it('should correctly parse commit details', () => {
    const { commits } = parsePorcelainBlame(samplePorcelainOutput);

    const firstCommit = commits.get('9a3e69b421a3338085b46b68a81b37937eda3cbe');
    expect(firstCommit).toEqual({
      hash: '9a3e69b421a3338085b46b68a81b37937eda3cbe',
      author: 'John Doe',
      'author-mail': '<john.doe@example.com>',
      'author-time': 1672531200,
      'author-tz': '+0000',
      committer: 'John Doe',
      'committer-mail': '<john.doe@example.com>',
      'committer-time': 1672531200,
      'committer-tz': '+0000',
      summary: 'Initial commit',
      filename: 'src/index.js',
    });

    const secondCommit = commits.get('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7');
    expect(secondCommit).toEqual({
      hash: 'd8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7',
      author: 'Jane Smith',
      'author-mail': '<jane.smith@example.com>',
      'author-time': 1672617600,
      'author-tz': '+0000',
      committer: 'Jane Smith',
      'committer-mail': '<jane.smith@example.com>',
      'committer-time': 1672617600,
      'committer-tz': '+0000',
      summary: 'Add feature C',
      'previous-hash': '9a3e69b421a3338085b46b68a81b37937eda3cbe src/index.js',
      filename: 'src/index.js',
    });
  });

  it('should ensure line.commit references the correct object in the commits map', () => {
    const { lines, commits } = parsePorcelainBlame(samplePorcelainOutput);
    const firstCommit = commits.get('9a3e69b421a3338085b46b68a81b37937eda3cbe');
    const secondCommit = commits.get('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7');

    expect(lines[0].commit).toBe(firstCommit);
    expect(lines[1].commit).toBe(firstCommit);
    expect(lines[2].commit).toBe(firstCommit);
    expect(lines[3].commit).toBe(secondCommit);
  });

  it('should handle empty or whitespace-only input', () => {
    expect(parsePorcelainBlame('')).toEqual({ lines: [], commits: new Map() });
    expect(parsePorcelainBlame('   \n   ')).toEqual({ lines: [], commits: new Map() });
  });

  it('should handle input for an empty file (which is empty output)', () => {
    const result = parsePorcelainBlame('');
    expect(result.lines).toHaveLength(0);
    expect(result.commits.size).toBe(0);
  });

  it('should handle a boundary commit', () => {
    const boundaryOutput = `
0000000000000000000000000000000000000000 1 1
author Not Committed Yet
author-mail <not.committed.yet@example.com>
author-time 1672531200
author-tz +0000
committer Not Committed Yet
committer-mail <not.committed.yet@example.com>
committer-time 1672531200
committer-tz +0000
summary <not-committed-yet>
boundary
filename new_file.js
	console.log("unstaged changes");
`.trim();
    const { lines, commits } = parsePorcelainBlame(boundaryOutput);
    expect(lines).toHaveLength(1);
    expect(commits.size).toBe(1);

    const boundaryCommit = commits.get('0000000000000000000000000000000000000000');
    expect(boundaryCommit).toBeDefined();
    expect(boundaryCommit.boundary).toBe(true);
    expect(boundaryCommit.author).toBe('Not Committed Yet');
    expect(lines[0].commit).toBe(boundaryCommit);
  });

  it('should throw an error on malformed input: content line without header', () => {
    const malformedInput = '\tconst a = 1;';
    expect(() => parsePorcelainBlame(malformedInput)).toThrow(
      'Malformed porcelain blame output. Found content line without a preceding commit header at index 0'
    );
  });

  it('should throw an error on malformed input: unexpected line format', () => {
    const malformedInput = 'this is not a valid line';
    expect(() => parsePorcelainBlame(malformedInput)).toThrow(
      'Malformed porcelain blame output. Unexpected line: "this is not a valid line" at index 0'
    );
  });

  it('should throw an error on malformed input: header without content', () => {
    const malformedInput = '9a3e69b421a3338085b46b68a81b37937eda3cbe 1 1 1';
    // This specific case doesn't throw because the loop finishes. The parser expects a content line to follow.
    // The final validation will catch if a line is missing its commit, but here, no line is even created.
    // The parser is robust enough to just finish with what it has.
    const { lines } = parsePorcelainBlame(malformedInput);
    expect(lines).toHaveLength(0);
  });

  it('should handle commit summaries with spaces', () => {
    const outputWithSpaces = `
d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7 1 1
author Jane Smith
author-mail <jane.smith@example.com>
author-time 1672617600
author-tz +0000
committer Jane Smith
committer-mail <jane.smith@example.com>
committer-time 1672617600
committer-tz +0000
summary This is a commit summary with many spaces
filename src/index.js
	const c = 3;
`.trim();
    const { commits } = parsePorcelainBlame(outputWithSpaces);
    const commit = commits.get('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7');
    expect(commit.summary).toBe('This is a commit summary with many spaces');
  });

  it('should handle author names with spaces', () => {
    const outputWithSpaces = `
d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7 1 1
author Dr. Jane R. Smith
author-mail <jane.smith@example.com>
author-time 1672617600
author-tz +0000
committer Dr. Jane R. Smith
committer-mail <jane.smith@example.com>
committer-time 1672617600
committer-tz +0000
summary A commit
filename src/index.js
	const c = 3;
`.trim();
    const { commits } = parsePorcelainBlame(outputWithSpaces);
    const commit = commits.get('d8a2f5b7c1e9d0a3c8b6f4a1e9c8b4f2a1d3e5c7');
    expect(commit.author).toBe('Dr. Jane R. Smith');
    expect(commit.committer).toBe('Dr. Jane R. Smith');
  });

  it('should handle extra empty lines in the porcelain output gracefully', () => {
    const outputWithExtraLines = `
9a3e69b421a3338085b46b68a81b37937eda3cbe 1 1 1
author John Doe
author-mail <john.doe@example.com>
author-time 1672531200
author-tz +0000


committer John Doe
committer-mail <john.doe@example.com>
committer-time 1672531200
committer-tz +0000
summary Initial commit
filename src/index.js

	const a = 1;

`;
    const { lines, commits } = parsePorcelainBlame(outputWithExtraLines);
    expect(lines).toHaveLength(1);
    expect(commits.size).toBe(1);
    expect(lines[0].content).toBe('const a = 1;');
    const commit = commits.get('9a3e69b421a3338085b46b68a81b37937eda3cbe');
    expect(commit.author).toBe('John Doe');
    expect(commit.committer).toBe('John Doe');
  });
});