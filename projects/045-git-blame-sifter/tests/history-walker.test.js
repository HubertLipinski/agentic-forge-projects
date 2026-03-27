import { jest } from '@jest/globals';
import { findSubstantiveBlame, clearHistoryWalkerCache } from '../src/analysis/history-walker.js';

// Mock the git-executor module
const mockExecuteGitCommand = jest.fn();
jest.unstable_mockModule('../src/utils/git-executor.js', () => ({
  executeGitCommand: mockExecuteGitCommand,
  GitCommandError: class extends Error {
    constructor(message, stderr = '') {
      super(message);
      this.stderr = stderr;
    }
  },
}));

// Mock the rule-engine module
const mockRunRuleEngine = jest.fn();
jest.unstable_mockModule('../src/engine/rule-engine.js', () => ({
  runRuleEngine: mockRunRuleEngine,
}));

// Mock the blame-parser module
const mockParsePorcelainBlame = jest.fn();
jest.unstable_mockModule('../src/analysis/blame-parser.js', () => ({
  parsePorcelainBlame: mockParsePorcelainBlame,
}));


describe('History Walker: findSubstantiveBlame', () => {
  const filePath = 'src/app.js';
  const repoPath = '/test/repo';
  const mockConfig = { some: 'config' };
  const mockContext = { repoPath, config: mockConfig };

  beforeEach(() => {
    // Clear all mock implementations and call counts before each test
    mockExecuteGitCommand.mockClear();
    mockRunRuleEngine.mockClear();
    mockParsePorcelainBlame.mockClear();
    clearHistoryWalkerCache();
  });

  test('should return the initial commit if the first parent is substantive', async () => {
    const trivialCommit = {
      hash: 'trivial123',
      author: 'Formatter Bot',
      'author-mail': '<bot@example.com>',
    };
    const substantiveCommit = {
      hash: 'substantive456',
      author: 'Dev One',
      'author-mail': '<dev1@example.com>',
    };

    // `git blame --reverse` for the trivial commit
    mockExecuteGitCommand.mockResolvedValueOnce({
      stdout: 'substantive456... some blame output',
      stderr: '',
    });

    // `parsePorcelainBlame` returns the parent commit
    mockParsePorcelainBlame.mockReturnValueOnce({
      lines: [{
        commit: substantiveCommit,
        originalLine: 5,
      }],
      commits: new Map([[substantiveCommit.hash, substantiveCommit]]),
    });

    // `runRuleEngine` identifies the parent as substantive
    mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: false, reason: null });

    const result = await findSubstantiveBlame(trivialCommit, 10, filePath, mockContext);

    expect(result).toBe(substantiveCommit);
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(1);
    expect(mockExecuteGitCommand).toHaveBeenCalledWith(
      ['blame', '--porcelain', '--reverse', 'trivial123^..trivial123', '-L', '10,10', '--', filePath],
      { cwd: repoPath }
    );
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(1);
    expect(mockRunRuleEngine).toHaveBeenCalledWith(substantiveCommit, mockContext);
  });

  test('should walk back multiple trivial commits to find the substantive one', async () => {
    const substantiveCommit = { hash: 'substantive789', author: 'Dev Two' };
    const trivialCommit1 = { hash: 'trivial456', author: 'Linter' };
    const trivialCommit2 = { hash: 'trivial123', author: 'Formatter Bot' }; // The starting commit

    // 1. Walk from trivialCommit2 to trivialCommit1
    mockExecuteGitCommand.mockResolvedValueOnce({ stdout: 'output for trivial1' });
    mockParsePorcelainBlame.mockReturnValueOnce({
      lines: [{ commit: trivialCommit1, originalLine: 8 }],
      commits: new Map([[trivialCommit1.hash, trivialCommit1]]),
    });
    mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: true, reason: 'Linter commit' });

    // 2. Walk from trivialCommit1 to substantiveCommit
    mockExecuteGitCommand.mockResolvedValueOnce({ stdout: 'output for substantive' });
    mockParsePorcelainBlame.mockReturnValueOnce({
      lines: [{ commit: substantiveCommit, originalLine: 5 }],
      commits: new Map([[substantiveCommit.hash, substantiveCommit]]),
    });
    mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: false, reason: null });

    const result = await findSubstantiveBlame(trivialCommit2, 10, filePath, mockContext);

    expect(result).toBe(substantiveCommit);
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(2);
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(2);

    // Check call arguments
    expect(mockExecuteGitCommand).toHaveBeenCalledWith(
      ['blame', '--porcelain', '--reverse', 'trivial123^..trivial123', '-L', '10,10', '--', filePath],
      { cwd: repoPath }
    );
    expect(mockExecuteGitCommand).toHaveBeenCalledWith(
      ['blame', '--porcelain', '--reverse', 'trivial456^..trivial456', '-L', '8,8', '--', filePath],
      { cwd: repoPath }
    );
    expect(mockRunRuleEngine).toHaveBeenCalledWith(trivialCommit1, mockContext);
    expect(mockRunRuleEngine).toHaveBeenCalledWith(substantiveCommit, mockContext);
  });

  test('should return the last found commit if history walk reaches the beginning', async () => {
    const firstCommit = { hash: 'firstcommit001', author: 'Initial Author' };
    const trivialCommit = { hash: 'trivial123', author: 'Formatter Bot' };

    // First walk finds the first commit
    mockExecuteGitCommand.mockResolvedValueOnce({ stdout: 'output for first commit' });
    mockParsePorcelainBlame.mockReturnValueOnce({
      lines: [{ commit: firstCommit, originalLine: 5 }],
      commits: new Map([[firstCommit.hash, firstCommit]]),
    });
    mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: true, reason: 'Also trivial' }); // Assume it's trivial for the test

    // Second walk `git blame` returns empty, indicating end of history for that line
    mockExecuteGitCommand.mockResolvedValueOnce({ stdout: ' \n ', stderr: '' });

    const result = await findSubstantiveBlame(trivialCommit, 10, filePath, mockContext);

    // It should return `firstCommit` because that's where the line was "created".
    expect(result).toBe(firstCommit);
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(2);
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(1);
  });

  test('should return the initial commit on git command error', async () => {
    const initialCommit = { hash: 'initial123', author: 'Dev' };
    const { GitCommandError } = await import('../src/utils/git-executor.js');

    mockExecuteGitCommand.mockRejectedValueOnce(
      new GitCommandError('fatal: no such path', 'fatal: no such path in initial123^')
    );

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await findSubstantiveBlame(initialCommit, 10, filePath, mockContext);

    expect(result).toBe(initialCommit);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[HistoryWalker] Git error during history walk'));
    consoleWarnSpy.mockRestore();
  });

  test('should return the last known commit if max depth is reached', async () => {
    const commits = Array.from({ length: 21 }, (_, i) => ({ hash: `commit${i}`, author: 'Bot' }));

    // Mock a chain of 21 trivial commits
    for (let i = 0; i < 20; i++) {
        mockExecuteGitCommand.mockResolvedValueOnce({ stdout: `output${i}` });
        mockParsePorcelainBlame.mockReturnValueOnce({
            lines: [{ commit: commits[i + 1], originalLine: 10 - i }],
            commits: new Map([[commits[i + 1].hash, commits[i + 1]]]),
        });
        mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: true });
    }

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await findSubstantiveBlame(commits[0], 10, filePath, mockContext);

    // Max depth is 20, so it should stop at the 20th parent (commits[20])
    expect(result).toBe(commits[20]);
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(20);
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(20);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Reached max recursion depth (20)'));
    consoleWarnSpy.mockRestore();
  });

  test('should use cache for subsequent calls with the same parameters', async () => {
    const trivialCommit = { hash: 'trivial123', author: 'Bot' };
    const substantiveCommit = { hash: 'substantive456', author: 'Dev' };

    // First call setup
    mockExecuteGitCommand.mockResolvedValueOnce({ stdout: 'output' });
    mockParsePorcelainBlame.mockReturnValueOnce({
      lines: [{ commit: substantiveCommit, originalLine: 5 }],
      commits: new Map([[substantiveCommit.hash, substantiveCommit]]),
    });
    mockRunRuleEngine.mockResolvedValueOnce({ isTrivial: false });

    // First call
    const result1 = await findSubstantiveBlame(trivialCommit, 10, filePath, mockContext);
    expect(result1).toBe(substantiveCommit);
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(1);
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(1);

    // Second call with same parameters
    const result2 = await findSubstantiveBlame(trivialCommit, 10, filePath, mockContext);
    expect(result2).toBe(substantiveCommit);

    // Mocks should NOT have been called again
    expect(mockExecuteGitCommand).toHaveBeenCalledTimes(1);
    expect(mockRunRuleEngine).toHaveBeenCalledTimes(1);
  });

  test('should handle invalid arguments gracefully', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const commit = { hash: 'a' };

    const result1 = await findSubstantiveBlame(null, 1, 'f', mockContext);
    expect(result1).toBeNull();

    const result2 = await findSubstantiveBlame(commit, null, 'f', mockContext);
    expect(result2).toBe(commit);

    const result3 = await findSubstantiveBlame(commit, 1, null, mockContext);
    expect(result3).toBe(commit);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[HistoryWalker] Invalid arguments for findSubstantiveBlame. Returning initial commit.');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    consoleWarnSpy.mockRestore();
  });
});