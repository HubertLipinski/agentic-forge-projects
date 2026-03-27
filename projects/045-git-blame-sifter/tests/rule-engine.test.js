import { jest } from '@jest/globals';
import { runRuleEngine, clearRuleEngineCache } from '../src/engine/rule-engine.js';

// Mock the individual rule modules
jest.unstable_mockModule('../src/rules/author-rule.js', () => ({
  authorRule: jest.fn(),
}));
jest.unstable_mockModule('../src/rules/commit-message-rule.js', () => ({
  commitMessageRule: jest.fn(),
}));
jest.unstable_mockModule('../src/rules/diff-triviality-rule.js', () => ({
  diffTrivialityRule: jest.fn(),
}));

// Dynamically import the mocked rules after setting up the mocks
const { authorRule } = await import('../src/rules/author-rule.js');
const { commitMessageRule } = await import('../src/rules/commit-message-rule.js');
const { diffTrivialityRule } = await import('../src/rules/diff-triviality-rule.js');

describe('RuleEngine', () => {
  // A standard commit object to be used in tests
  const sampleCommit = {
    hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    author: 'Test Author',
    'author-mail': '<test@example.com>',
    summary: 'feat: add new feature',
  };

  // A standard context object
  const sampleContext = {
    repoPath: '/tmp/fake-repo',
    config: {
      ignoreAuthors: [],
      commitMessage: '',
      isTrivial: false,
    },
  };

  // Reset mocks and caches before each test
  beforeEach(() => {
    jest.clearAllMocks();
    clearRuleEngineCache();
    // Reset mocks to a default non-trivial result
    authorRule.mockResolvedValue({ isTrivial: false, reason: null });
    commitMessageRule.mockResolvedValue({ isTrivial: false, reason: null });
    diffTrivialityRule.mockResolvedValue({ isTrivial: false, reason: null });
  });

  describe('Input Validation', () => {
    it('should throw an error if the commit object is missing', async () => {
      await expect(runRuleEngine(null, sampleContext)).rejects.toThrow(
        '[RuleEngine] A commit object with a valid "hash" property is required.'
      );
    });

    it('should throw an error if the commit hash is missing', async () => {
      await expect(runRuleEngine({ author: 'test' }, sampleContext)).rejects.toThrow(
        '[RuleEngine] A commit object with a valid "hash" property is required.'
      );
    });

    it('should throw an error if the context object is missing', async () => {
      await expect(runRuleEngine(sampleCommit, null)).rejects.toThrow(
        '[RuleEngine] A context object with "config" and "repoPath" is required.'
      );
    });

    it('should throw an error if context.config is missing', async () => {
      await expect(runRuleEngine(sampleCommit, { repoPath: '/tmp' })).rejects.toThrow(
        '[RuleEngine] A context object with "config" and "repoPath" is required.'
      );
    });

    it('should throw an error if context.repoPath is missing', async () => {
      await expect(runRuleEngine(sampleCommit, { config: {} })).rejects.toThrow(
        '[RuleEngine] A context object with "config" and "repoPath" is required.'
      );
    });
  });

  describe('Rule Execution Logic', () => {
    it('should return non-trivial if no rules match', async () => {
      const result = await runRuleEngine(sampleCommit, sampleContext);
      expect(result).toEqual({ isTrivial: false, reason: null });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);
    });

    it('should short-circuit and return trivial if authorRule matches', async () => {
      authorRule.mockResolvedValue({ isTrivial: true, reason: 'Author ignored' });

      const result = await runRuleEngine(sampleCommit, sampleContext);

      expect(result).toEqual({ isTrivial: true, reason: 'Author ignored' });
      expect(authorRule).toHaveBeenCalledTimes(1);
      // The other rules should not have been called
      expect(commitMessageRule).not.toHaveBeenCalled();
      expect(diffTrivialityRule).not.toHaveBeenCalled();
    });

    it('should short-circuit and return trivial if commitMessageRule matches', async () => {
      commitMessageRule.mockResolvedValue({ isTrivial: true, reason: 'Message matches pattern' });

      const result = await runRuleEngine(sampleCommit, sampleContext);

      expect(result).toEqual({ isTrivial: true, reason: 'Message matches pattern' });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      // The diff rule should not have been called
      expect(diffTrivialityRule).not.toHaveBeenCalled();
    });

    it('should return trivial if only diffTrivialityRule matches', async () => {
      diffTrivialityRule.mockResolvedValue({ isTrivial: true, reason: 'Whitespace only' });

      const result = await runRuleEngine(sampleCommit, sampleContext);

      expect(result).toEqual({ isTrivial: true, reason: 'Whitespace only' });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle a rule throwing an error and return non-trivial', async () => {
      const error = new Error('Unexpected Git error');
      commitMessageRule.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await runRuleEngine(sampleCommit, sampleContext);

      expect(result).toEqual({
        isTrivial: false,
        reason: "Rule 'commitMessageRule' encountered a critical error.",
      });

      // It should not proceed to the next rule after a critical failure
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).not.toHaveBeenCalled();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[RuleEngine] Unhandled exception in rule \'commitMessageRule\' for commit a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2: Unexpected Git error'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle a rule failing gracefully and continue execution', async () => {
      const failReason = 'Rule failed to execute: Could not get commit summary';
      commitMessageRule.mockResolvedValue({ isTrivial: false, reason: failReason });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await runRuleEngine(sampleCommit, sampleContext);

      // The final result should be non-trivial because other rules didn't match
      expect(result).toEqual({ isTrivial: false, reason: null });

      // All rules should have been executed
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Rule 'commitMessageRule' failed on commit ${sampleCommit.hash} but did not throw.`)
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Caching', () => {
    it('should cache the result for a commit hash', async () => {
      // First run: all rules are called
      const result1 = await runRuleEngine(sampleCommit, sampleContext);
      expect(result1).toEqual({ isTrivial: false, reason: null });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);

      // Second run: no rules should be called, result should come from cache
      const result2 = await runRuleEngine(sampleCommit, sampleContext);
      expect(result2).toEqual({ isTrivial: false, reason: null });
      // The call count should not have increased
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);
    });

    it('should not use cache for a different commit hash', async () => {
      const anotherCommit = { ...sampleCommit, hash: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5' };

      // Run for the first commit
      await runRuleEngine(sampleCommit, sampleContext);
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(1);

      // Run for the second commit
      await runRuleEngine(anotherCommit, sampleContext);
      // The call counts should have incremented
      expect(authorRule).toHaveBeenCalledTimes(2);
      expect(commitMessageRule).toHaveBeenCalledTimes(2);
      expect(diffTrivialityRule).toHaveBeenCalledTimes(2);
    });

    it('should cache a trivial result and short-circuit on subsequent calls', async () => {
      commitMessageRule.mockResolvedValue({ isTrivial: true, reason: 'Trivial message' });

      // First run: rules are called until a match is found
      const result1 = await runRuleEngine(sampleCommit, sampleContext);
      expect(result1).toEqual({ isTrivial: true, reason: 'Trivial message' });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).not.toHaveBeenCalled();

      // Second run: no rules should be called
      const result2 = await runRuleEngine(sampleCommit, sampleContext);
      expect(result2).toEqual({ isTrivial: true, reason: 'Trivial message' });
      expect(authorRule).toHaveBeenCalledTimes(1);
      expect(commitMessageRule).toHaveBeenCalledTimes(1);
      expect(diffTrivialityRule).not.toHaveBeenCalled();
    });

    it('clearRuleEngineCache should clear the result cache', async () => {
      // First run to populate the cache
      await runRuleEngine(sampleCommit, sampleContext);
      expect(authorRule).toHaveBeenCalledTimes(1);

      // Second run to confirm caching works
      await runRuleEngine(sampleCommit, sampleContext);
      expect(authorRule).toHaveBeenCalledTimes(1);

      // Clear the cache
      clearRuleEngineCache();

      // Third run should re-execute the rules
      await runRuleEngine(sampleCommit, sampleContext);
      expect(authorRule).toHaveBeenCalledTimes(2);
    });
  });
});