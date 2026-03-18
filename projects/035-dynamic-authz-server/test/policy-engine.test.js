// @ts-check
// The above line enables type checking for this file in VS Code.
// This is a JSDoc-based type annotation that works in plain JavaScript.

import tap from 'tap';
import { evaluatePolicies } from '../src/policy/engine.js';
import { createLogger } from '../src/utils/logger.js';

// Create a silent logger for tests to avoid cluttering test output.
// The logger can be overridden in specific tests if needed.
const silentLogger = createLogger({ logLevel: 'silent' });

tap.test('Policy Engine: evaluatePolicies()', (t) => {
  t.test('should deny by default if no policies are provided', (t) => {
    const context = { user: { id: 'user-1' } };
    const result = evaluatePolicies({ policies: [], context, requestLogger: silentLogger });

    t.equal(result.decision, 'deny', 'decision should be "deny"');
    t.equal(result.matchedPolicyId, null, 'matchedPolicyId should be null');
    t.has(result.reasons, ['Default deny: No policies were available to evaluate.'], 'reason should indicate no policies');
    t.end();
  });

  t.test('should deny by default if no policies match', (t) => {
    const policies = [
      {
        id: 'admin-only',
        description: 'Allow access only to admin users',
        condition: { '==': [{ var: 'user.role' }, 'admin'] },
      },
    ];
    const context = { user: { id: 'user-1', role: 'guest' } };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'deny', 'decision should be "deny"');
    t.equal(result.matchedPolicyId, null, 'matchedPolicyId should be null');
    t.has(result.reasons, ['Default deny: No policy explicitly allowed the request.'], 'reason should indicate default deny');
    t.end();
  });

  t.test('should allow if a policy condition evaluates to true', (t) => {
    const policies = [
      {
        id: 'allow-read-public',
        description: 'Allow reading public documents',
        condition: {
          and: [
            { '==': [{ var: 'action.type' }, 'read'] },
            { '==': [{ var: 'resource.visibility' }, 'public'] },
          ],
        },
      },
    ];
    const context = {
      action: { type: 'read' },
      resource: { type: 'document', visibility: 'public' },
    };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'allow', 'decision should be "allow"');
    t.equal(result.matchedPolicyId, 'allow-read-public', 'should match the correct policy ID');
    t.has(result.reasons, ['Allowed by policy "allow-read-public": Allow reading public documents.'], 'reason should state which policy allowed');
    t.end();
  });

  t.test('should stop evaluation and allow on the first matching policy', (t) => {
    const policies = [
      {
        id: 'deny-all',
        description: 'This should be skipped',
        condition: { '==': [1, 0] }, // always false
      },
      {
        id: 'allow-editors',
        description: 'Allow editors to edit articles',
        condition: {
          and: [
            { 'in': ['editor', { var: 'user.roles' }] },
            { '==': [{ var: 'action.type' }, 'edit'] },
            { '==': [{ var: 'resource.type' }, 'article'] },
          ],
        },
      },
      {
        id: 'allow-admins-superfluous',
        description: 'This should not be evaluated',
        condition: { '==': [{ var: 'user.role' }, 'admin'] },
      },
    ];
    const context = {
      user: { id: 'user-2', roles: ['guest', 'editor'] },
      action: { type: 'edit' },
      resource: { type: 'article', id: 'article-123' },
    };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'allow', 'decision should be "allow"');
    t.equal(result.matchedPolicyId, 'allow-editors', 'should match the first applicable policy');
    t.end();
  });

  t.test('should handle complex ABAC scenarios correctly', (t) => {
    const policies = [
      {
        id: 'allow-owner-edit-draft',
        description: 'Allow a user to edit their own document if it is in "draft" status',
        condition: {
          and: [
            { '==': [{ var: 'action.type' }, 'edit'] },
            { '==': [{ var: 'resource.type' }, 'document'] },
            { '==': [{ var: 'resource.status' }, 'draft'] },
            { '==': [{ var: 'user.id' }, { var: 'resource.ownerId' }] },
          ],
        },
      },
    ];

    t.test('should allow when all ABAC conditions are met', (t) => {
      const context = {
        user: { id: 'user-xyz' },
        action: { type: 'edit' },
        resource: { type: 'document', ownerId: 'user-xyz', status: 'draft' },
      };
      const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });
      t.equal(result.decision, 'allow', 'should allow owner to edit their own draft');
      t.equal(result.matchedPolicyId, 'allow-owner-edit-draft');
      t.end();
    });

    t.test('should deny if user is not the owner', (t) => {
      const context = {
        user: { id: 'user-abc' }, // Different user
        action: { type: 'edit' },
        resource: { type: 'document', ownerId: 'user-xyz', status: 'draft' },
      };
      const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });
      t.equal(result.decision, 'deny', 'should deny if user is not the owner');
      t.end();
    });

    t.test('should deny if document status is not "draft"', (t) => {
      const context = {
        user: { id: 'user-xyz' },
        action: { type: 'edit' },
        resource: { type: 'document', ownerId: 'user-xyz', status: 'published' }, // Not a draft
      };
      const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });
      t.equal(result.decision, 'deny', 'should deny if status is not draft');
      t.end();
    });

    t.end();
  });

  t.test('should handle RBAC scenarios with roles array', (t) => {
    const policies = [
      {
        id: 'billing-manager-access',
        description: 'Allow billing managers to access billing resources',
        condition: {
          and: [
            { 'in': ['billing_manager', { var: 'user.roles' }] },
            { '==': [{ var: 'resource.department' }, 'billing'] },
          ],
        },
      },
    ];

    t.test('should allow if user has the required role', (t) => {
      const context = {
        user: { id: 'user-3', roles: ['employee', 'billing_manager'] },
        resource: { department: 'billing' },
      };
      const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });
      t.equal(result.decision, 'allow');
      t.equal(result.matchedPolicyId, 'billing-manager-access');
      t.end();
    });

    t.test('should deny if user does not have the required role', (t) => {
      const context = {
        user: { id: 'user-4', roles: ['employee', 'support_agent'] },
        resource: { department: 'billing' },
      };
      const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });
      t.equal(result.decision, 'deny');
      t.end();
    });

    t.end();
  });

  t.test('should handle malformed policies gracefully', (t) => {
    const policies = [
      null, // null policy
      {}, // empty policy object
      { id: 'valid-but-unmatched', condition: { '==': [1, 0] } }, // valid but missing description
      { id: 'malformed-condition', description: 'bad', condition: 'not-an-object' }, // condition is not an object
      {
        id: 'allow-finally',
        description: 'A valid policy at the end',
        condition: { '==': [{ var: 'user.id' }, 'test-user'] },
      },
    ];
    const context = { user: { id: 'test-user' } };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'allow', 'should eventually find and apply a valid policy');
    t.equal(result.matchedPolicyId, 'allow-finally', 'should match the valid policy');
    t.end();
  });

  t.test('should deny and log an error if a policy condition throws an exception', (t) => {
    const policies = [
      {
        id: 'broken-policy',
        description: 'This policy has a broken json-logic rule',
        condition: { log: 'this-will-throw-in-json-logic' }, // 'log' is not a standard operator
      },
      {
        id: 'fallback-policy',
        description: 'This policy should not be reached',
        condition: { '==': [1, 1] },
      },
    ];
    const context = { user: { id: 'user-1' } };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    // The engine should treat the error as a non-match and continue.
    // Since the next policy is a catch-all allow, the final decision is 'allow'.
    t.equal(result.decision, 'allow', 'should continue evaluation after a broken policy');
    t.equal(result.matchedPolicyId, 'fallback-policy');
    t.end();
  });

  t.test('should deny if a policy condition evaluates to a non-true, truthy value', (t) => {
    // json-logic can return truthy values like `[1]`, `1`, or `{}`.
    // The engine must strictly check for `true`.
    const policies = [
      {
        id: 'truthy-array',
        description: 'This returns a truthy array',
        condition: { filter: [{ var: 'items' }, { '>': [{ var: '' }, 0] }] }, // returns [1, 2]
      },
      {
        id: 'truthy-number',
        description: 'This returns a truthy number',
        condition: { '+': [1, 1] }, // returns 2
      },
    ];
    const context = { items: [1, 2, 3] };
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'deny', 'should deny even if condition returns a truthy, non-boolean value');
    t.equal(result.matchedPolicyId, null, 'no policy should be considered a match');
    t.end();
  });

  t.test('should use default description if policy description is missing', (t) => {
    const policies = [
      {
        id: 'no-description-policy',
        condition: { '==': [1, 1] },
      },
    ];
    const context = {};
    const result = evaluatePolicies({ policies, context, requestLogger: silentLogger });

    t.equal(result.decision, 'allow');
    t.equal(result.matchedPolicyId, 'no-description-policy');
    t.has(result.reasons, ['Allowed by policy "no-description-policy": No description.'], 'reason should use default text');
    t.end();
  });

  t.end();
});