/**
 * @file tests/matcher.test.js
 * @description Unit tests for the PR matching logic in src/core/matcher.js.
 *
 * This test suite covers all aspects of the pull request evaluation logic,
 * including author matching, label matching, branch pattern matching, and
 * CI check evaluation. It uses a mock-based approach to simulate various
 * pull request scenarios and verifies that the `evaluatePullRequest` function
 * behaves as expected for each configured rule.
 */

import { describe, it, expect, vi } from 'vitest';
import { evaluatePullRequest } from '../src/core/matcher.js';
import logger from '../src/utils/logger.js';

// Mock the logger to prevent console output during tests and to spy on it if needed.
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
  },
}));

// --- Test Data Fixtures ---

/**
 * Creates a mock pull request object for testing.
 * @param {object} overrides - Properties to override in the base mock.
 * @returns {object} A mock pull request object.
 */
const createMockPR = (overrides = {}) => ({
  number: 123,
  title: 'feat: Implement new feature',
  user: { login: 'test-user' },
  labels: [],
  head: { ref: 'feature-branch' },
  base: { ref: 'main' },
  ...overrides,
});

/**
 * Creates a mock PR details object for testing.
 * @param {object} overrides - Properties to override in the base mock.
 * @returns {object} A mock PR details object.
 */
const createMockDetails = (overrides = {}) => ({
  isDraft: false,
  mergeableState: 'clean', // 'clean', 'unstable', 'blocked'
  checkRuns: [],
  reviews: [],
  ...overrides,
});

/**
 * Creates a mock rule object for testing.
 * @param {object} overrides - Properties to override in the base mock.
 * @returns {object} A mock rule object.
 */
const createMockRule = (overrides = {}) => ({
  when: [],
  merge: 'merge',
  checks: 'stable',
  ...overrides,
});

// --- Test Suite ---

describe('evaluatePullRequest', () => {
  // Reset mocks before each test to ensure isolation.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Pre-condition Checks ---

  it('should return no match if the PR is a draft', async () => {
    const pullRequest = createMockPR();
    const details = createMockDetails({ isDraft: true });
    const rule = createMockRule({ when: ['author:test-user'] });

    const result = await evaluatePullRequest(pullRequest, details, rule);

    expect(result.isMatch).toBe(false);
    expect(result.reasons).toContain('PR #123 is a draft.');
  });

  it('should return no match if the PR has merge conflicts (unstable)', async () => {
    const pullRequest = createMockPR();
    const details = createMockDetails({ mergeableState: 'unstable' });
    const rule = createMockRule({ when: ['author:test-user'] });

    const result = await evaluatePullRequest(pullRequest, details, rule);

    expect(result.isMatch).toBe(false);
    expect(result.reasons).toContain('PR #123 has merge conflicts.');
  });

  it('should return no match if the PR is blocked (but continue evaluation)', async () => {
    const pullRequest = createMockPR();
    const details = createMockDetails({ mergeableState: 'blocked' });
    // Rule doesn't match, so the block reason is secondary
    const rule = createMockRule({ when: ['author:wrong-user'] });

    const result = await evaluatePullRequest(pullRequest, details, rule);

    expect(result.isMatch).toBe(false);
    expect(result.reasons).toContain('PR #123 is blocked (failing checks or missing required reviews).');
    expect(result.reasons).toContain('PR #123 does not match any \'when\' conditions for this rule.');
  });

  // --- 'when' Condition Matching ---

  it('should return no match if no "when" conditions are met', async () => {
    const pullRequest = createMockPR({ user: { login: 'another-user' } });
    const details = createMockDetails();
    const rule = createMockRule({ when: ['author:dependabot[bot]', 'label:auto-merge'] });

    const result = await evaluatePullRequest(pullRequest, details, rule);

    expect(result.isMatch).toBe(false);
    expect(result.reasons).toContain('PR #123 does not match any \'when\' conditions for this rule.');
  });

  // --- Author Matching ---

  describe('Author Matching', () => {
    it('should match a specific author', async () => {
      const pullRequest = createMockPR({ user: { login: 'dependabot[bot]' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['author:dependabot[bot]'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain("Author 'dependabot[bot]' matches pattern 'dependabot[bot]'.");
    });

    it('should match an author using a glob pattern', async () => {
      const pullRequest = createMockPR({ user: { login: 'dependabot-preview[bot]' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['author:dependabot*'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain("Author 'dependabot-preview[bot]' matches pattern 'dependabot*'.");
    });

    it('should not match a different author', async () => {
      const pullRequest = createMockPR({ user: { login: 'random-user' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['author:dependabot[bot]'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
    });
  });

  // --- Label Matching ---

  describe('Label Matching', () => {
    it('should match if all required labels are present', async () => {
      const pullRequest = createMockPR({ labels: [{ name: 'auto-merge' }, { name: 'docs' }] });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['label:auto-merge', 'label:docs'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain('All required labels found: [auto-merge, docs].');
    });

    it('should not match if any required label is missing', async () => {
      const pullRequest = createMockPR({ labels: [{ name: 'auto-merge' }] });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['label:auto-merge', 'label:dependencies'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain('Missing required labels: [dependencies].');
    });

    it('should not match if no labels are present but are required', async () => {
      const pullRequest = createMockPR();
      const details = createMockDetails();
      const rule = createMockRule({ when: ['label:auto-merge'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain('Missing required labels: [auto-merge].');
    });
  });

  // --- Branch Matching ---

  describe('Branch Matching', () => {
    it('should match a specific head and base branch pattern', async () => {
      const pullRequest = createMockPR({ head: { ref: 'hotfix/fix-bug' }, base: { ref: 'main' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['branch:hotfix/*<-main'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain("Branches 'hotfix/fix-bug <- main' match pattern 'hotfix/*<-main'.");
    });

    it('should match a head branch pattern with any base branch', async () => {
      const pullRequest = createMockPR({ head: { ref: 'dependabot/npm/lodash-4.17.21' }, base: { ref: 'develop' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['branch:dependabot/**'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain("Branches 'dependabot/npm/lodash-4.17.21 <- develop' match pattern 'dependabot/**'.");
    });

    it('should not match if the base branch does not match the pattern', async () => {
      const pullRequest = createMockPR({ head: { ref: 'hotfix/fix-bug' }, base: { ref: 'develop' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['branch:hotfix/*<-main'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
    });

    it('should not match if the head branch does not match the pattern', async () => {
      const pullRequest = createMockPR({ head: { ref: 'feature/new-thing' }, base: { ref: 'main' } });
      const details = createMockDetails();
      const rule = createMockRule({ when: ['branch:hotfix/*<-main'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
    });
  });

  // --- CI Checks Evaluation ---

  describe('CI Checks Evaluation', () => {
    const successCheck = { name: 'build', status: 'completed', conclusion: 'success' };
    const neutralCheck = { name: 'coverage', status: 'completed', conclusion: 'neutral' };
    const skippedCheck = { name: 'deploy-preview', status: 'completed', conclusion: 'skipped' };
    const pendingCheck = { name: 'lint', status: 'in_progress', conclusion: null };
    const failedCheck = { name: 'test', status: 'completed', conclusion: 'failure' };

    it('should pass with no check runs', async () => {
      const pullRequest = createMockPR({ user: { login: 'test-user' } });
      const details = createMockDetails({ checkRuns: [] });
      const rule = createMockRule({ when: ['author:test-user'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.reasons).toContain("CI checks passed the 'stable' policy.");
    });

    it('should fail if any check is pending', async () => {
      const pullRequest = createMockPR({ user: { login: 'test-user' } });
      const details = createMockDetails({ checkRuns: [successCheck, pendingCheck] });
      const rule = createMockRule({ when: ['author:test-user'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain("CI checks do not meet the 'stable' policy: Pending check found: 'lint' has status 'in_progress'.");
    });

    it('should fail if any check has failed', async () => {
      const pullRequest = createMockPR({ user: { login: 'test-user' } });
      const details = createMockDetails({ checkRuns: [successCheck, failedCheck] });
      const rule = createMockRule({ when: ['author:test-user'] });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain("CI checks do not meet the 'stable' policy: Failing check found: 'test' has conclusion 'failure'.");
    });

    describe('Policy: "all"', () => {
      it('should pass if all checks are "success"', async () => {
        const pullRequest = createMockPR({ user: { login: 'test-user' } });
        const details = createMockDetails({ checkRuns: [successCheck, { ...successCheck, name: 'test' }] });
        const rule = createMockRule({ when: ['author:test-user'], checks: 'all' });

        const result = await evaluatePullRequest(pullRequest, details, rule);

        expect(result.isMatch).toBe(true);
        expect(result.reasons).toContain("CI checks passed the 'all' policy.");
      });

      it('should fail if any check is not "success" (e.g., neutral)', async () => {
        const pullRequest = createMockPR({ user: { login: 'test-user' } });
        const details = createMockDetails({ checkRuns: [successCheck, neutralCheck] });
        const rule = createMockRule({ when: ['author:test-user'], checks: 'all' });

        const result = await evaluatePullRequest(pullRequest, details, rule);

        expect(result.isMatch).toBe(false);
        expect(result.reasons).toContain("CI checks do not meet the 'all' policy: Check 'coverage' did not succeed (conclusion: neutral) as required by 'all' policy.");
      });
    });

    describe('Policy: "stable"', () => {
      it('should pass with a mix of success, neutral, and skipped checks', async () => {
        const pullRequest = createMockPR({ user: { login: 'test-user' } });
        const details = createMockDetails({ checkRuns: [successCheck, neutralCheck, skippedCheck] });
        const rule = createMockRule({ when: ['author:test-user'], checks: 'stable' });

        const result = await evaluatePullRequest(pullRequest, details, rule);

        expect(result.isMatch).toBe(true);
        expect(result.reasons).toContain("CI checks passed the 'stable' policy.");
      });

      it('should fail if any check has a non-allowed conclusion (e.g., "stale")', async () => {
        const staleCheck = { name: 'old-check', status: 'completed', conclusion: 'stale' };
        const pullRequest = createMockPR({ user: { login: 'test-user' } });
        const details = createMockDetails({ checkRuns: [successCheck, staleCheck] });
        const rule = createMockRule({ when: ['author:test-user'], checks: 'stable' });

        const result = await evaluatePullRequest(pullRequest, details, rule);

        expect(result.isMatch).toBe(false);
        expect(result.reasons).toContain("CI checks do not meet the 'stable' policy: Failing check found: 'old-check' has conclusion 'stale'.");
      });
    });
  });

  // --- Complex Scenarios ---

  describe('Complex Scenarios', () => {
    it('should match when author and label conditions are both met', async () => {
      const pullRequest = createMockPR({
        user: { login: 'core-dev' },
        labels: [{ name: 'ready-for-merge' }],
      });
      const details = createMockDetails({ checkRuns: [{ name: 'ci', status: 'completed', conclusion: 'success' }] });
      const rule = createMockRule({
        when: ['author:core-dev', 'label:ready-for-merge'],
        merge: 'squash',
      });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.mergeMethod).toBe('squash');
      expect(result.reasons).toContain("Author 'core-dev' matches pattern 'core-dev'.");
      expect(result.reasons).toContain('All required labels found: [ready-for-merge].');
      expect(result.reasons).toContain("CI checks passed the 'stable' policy.");
    });

    it('should not match if only one of multiple required conditions is met (e.g., author but not label)', async () => {
      const pullRequest = createMockPR({
        user: { login: 'core-dev' },
        labels: [{ name: 'work-in-progress' }],
      });
      const details = createMockDetails();
      const rule = createMockRule({
        when: ['author:core-dev', 'label:ready-for-merge'],
      });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain("Author 'core-dev' matches pattern 'core-dev'.");
      expect(result.reasons).toContain('Missing required labels: [ready-for-merge].');
    });

    it('should match if any one of different condition types is met (e.g., author OR label)', async () => {
      // This test clarifies that `when` is a collection of conditions that must be satisfied.
      // If `author:a` and `label:b` are in `when`, the PR must have author `a` AND label `b`.
      // The logic doesn't support OR between different types within a single rule.
      const pullRequest = createMockPR({
        user: { login: 'core-dev' },
        labels: [],
      });
      const details = createMockDetails();
      const rule = createMockRule({
        when: ['author:core-dev', 'label:ready-for-merge'],
      });

      const result = await evaluatePullRequest(pullRequest, details, rule);
      expect(result.isMatch).toBe(false);
      expect(result.reasons).toContain('Missing required labels: [ready-for-merge].');
    });

    it('should correctly return the specified merge method on a successful match', async () => {
      const pullRequest = createMockPR({ user: { login: 'test-user' } });
      const details = createMockDetails();
      const rule = createMockRule({
        when: ['author:test-user'],
        merge: 'rebase',
      });

      const result = await evaluatePullRequest(pullRequest, details, rule);

      expect(result.isMatch).toBe(true);
      expect(result.mergeMethod).toBe('rebase');
    });
  });
});