import tap from 'tap';
import { randomUUID } from 'node:crypto';
import buildServer from '../src/server.js';
import { policyStore } from '../src/policy/store.js';
import memoryStore from '../src/storage/memory-store.js';
import { createLogger } from '../src/utils/logger.js';

// Use a silent logger for tests to keep the output clean.
const testLogger = createLogger({ logLevel: 'silent' });

tap.test('API Integration Tests', async (t) => {
  let server;

  // Use beforeEach to build a fresh server and reset storage for each test.
  // This ensures test isolation.
  t.beforeEach(async () => {
    // 1. Reset the underlying storage map.
    await memoryStore.disconnect(); // Clears the map
    await memoryStore.connect();

    // 2. Re-initialize the policy store, which reloads the (now empty) cache.
    await policyStore.initialize();

    // 3. Build a new server instance for the test.
    server = buildServer({ logger: testLogger });
    await server.ready();
  });

  // Use afterEach to tear down the server after each test.
  t.afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  t.test('/health endpoint', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    t.equal(response.statusCode, 200, 'should return 200 OK');
    t.equal(response.headers['content-type'], 'application/json; charset=utf-8', 'should return json');
    const payload = response.json();
    t.equal(payload.status, 'ok', 'should have status "ok"');
    t.ok(payload.name, 'should include app name');
    t.ok(payload.version, 'should include app version');
    t.ok(payload.timestamp, 'should include timestamp');
  });

  t.test('404 Not Found handler', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    t.equal(response.statusCode, 404, 'should return 404 Not Found');
    const payload = response.json();
    t.equal(payload.error, 'Not Found', 'should have correct error message');
    t.match(payload.message, /Route GET:\/non-existent-route not found/, 'should detail the missing route');
  });

  t.test('/policies API - Full CRUD Lifecycle', async (t) => {
    const policyId = `test-policy-${randomUUID().slice(0, 8)}`;
    const policy = {
      id: policyId,
      description: 'A test policy for CRUD operations',
      condition: { '==': [{ var: 'user.role' }, 'admin'] },
    };

    // 1. Initially, no policies should exist.
    t.test('GET /policies (initial)', async (t) => {
      const response = await server.inject({ method: 'GET', url: '/policies' });
      t.equal(response.statusCode, 200, 'should return 200');
      t.same(response.json(), [], 'should return an empty array');
    });

    // 2. Create a new policy.
    t.test('POST /policies', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/policies',
        payload: policy,
      });
      t.equal(response.statusCode, 201, 'should return 201 Created');
      t.same(response.json(), policy, 'should return the created policy');
    });

    // 3. Attempt to create a duplicate policy.
    t.test('POST /policies (conflict)', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/policies',
        payload: policy,
      });
      t.equal(response.statusCode, 409, 'should return 409 Conflict');
      const payload = response.json();
      t.equal(payload.error, 'Conflict', 'should indicate a conflict error');
      t.match(payload.message, /already exists/, 'should have a clear conflict message');
    });

    // 4. Retrieve the created policy by its ID.
    t.test('GET /policies/:id', async (t) => {
      const response = await server.inject({
        method: 'GET',
        url: `/policies/${policyId}`,
      });
      t.equal(response.statusCode, 200, 'should return 200 OK');
      t.same(response.json(), policy, 'should return the correct policy');
    });

    // 5. List all policies and see the new one.
    t.test('GET /policies (after create)', async (t) => {
      const response = await server.inject({ method: 'GET', url: '/policies' });
      t.equal(response.statusCode, 200, 'should return 200');
      t.equal(response.json().length, 1, 'should contain one policy');
      t.same(response.json()[0], policy, 'should contain the newly created policy');
    });

    // 6. Update the policy.
    t.test('PUT /policies/:id', async (t) => {
      const updatePayload = {
        description: 'An updated description',
        condition: { '==': [{ var: 'user.role' }, 'super-admin'] },
      };
      const response = await server.inject({
        method: 'PUT',
        url: `/policies/${policyId}`,
        payload: updatePayload,
      });
      t.equal(response.statusCode, 200, 'should return 200 OK');
      const updatedPolicy = response.json();
      t.equal(updatedPolicy.id, policyId, 'ID should remain unchanged');
      t.equal(updatedPolicy.description, updatePayload.description, 'description should be updated');
      t.same(updatedPolicy.condition, updatePayload.condition, 'condition should be updated');
    });

    // 7. Verify the update by fetching the policy again.
    t.test('GET /policies/:id (after update)', async (t) => {
      const response = await server.inject({
        method: 'GET',
        url: `/policies/${policyId}`,
      });
      t.equal(response.statusCode, 200, 'should return 200 OK');
      const fetchedPolicy = response.json();
      t.equal(fetchedPolicy.description, 'An updated description', 'fetched policy should reflect the update');
    });

    // 8. Delete the policy.
    t.test('DELETE /policies/:id', async (t) => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/policies/${policyId}`,
      });
      t.equal(response.statusCode, 204, 'should return 204 No Content');
      t.equal(response.payload, '', 'should have an empty body');
    });

    // 9. Verify deletion by trying to fetch it again.
    t.test('GET /policies/:id (after delete)', async (t) => {
      const response = await server.inject({
        method: 'GET',
        url: `/policies/${policyId}`,
      });
      t.equal(response.statusCode, 404, 'should return 404 Not Found');
    });

    // 10. List all policies again to confirm it's gone.
    t.test('GET /policies (after delete)', async (t) => {
      const response = await server.inject({ method: 'GET', url: '/policies' });
      t.equal(response.statusCode, 200, 'should return 200');
      t.same(response.json(), [], 'should return an empty array');
    });
  });

  t.test('/policies API - Validation', async (t) => {
    t.test('POST with invalid body', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/policies',
        payload: { id: 'invalid', description: 123 }, // description is not a string
      });
      t.equal(response.statusCode, 400, 'should return 400 Bad Request');
      const payload = response.json();
      t.equal(payload.error, 'Bad Request', 'should have correct error type');
      t.ok(payload.details.some(d => d.includes('must be string')), 'should detail the validation error');
    });

    t.test('PUT with invalid body', async (t) => {
      // First, create a policy to update
      const policyId = 'policy-to-update';
      await server.inject({
        method: 'POST',
        url: '/policies',
        payload: { id: policyId, description: 'initial', condition: { '==': [1, 1] } },
      });

      const response = await server.inject({
        method: 'PUT',
        url: `/policies/${policyId}`,
        payload: { condition: 'not-an-object' },
      });
      t.equal(response.statusCode, 400, 'should return 400 Bad Request');
      const payload = response.json();
      t.ok(payload.details.some(d => d.includes('must be object')), 'should detail the validation error');
    });

    t.test('GET with invalid ID format', async (t) => {
      const response = await server.inject({
        method: 'GET',
        url: '/policies/invalid!id', // Contains '!' which is not allowed
      });
      t.equal(response.statusCode, 400, 'should return 400 Bad Request');
      const payload = response.json();
      t.ok(payload.details.some(d => d.includes('must match pattern')), 'should detail the pattern mismatch');
    });
  });

  t.test('/authorize API - Authorization Logic', async (t) => {
    // Setup policies for the authorization tests
    const policies = [
      {
        id: 'allow-admins-to-read-docs',
        description: 'Admins can read any document',
        condition: {
          and: [
            { '==': [{ var: 'user.role' }, 'admin'] },
            { '==': [{ var: 'action.name' }, 'read'] },
            { '==': [{ var: 'resource.type' }, 'document'] },
          ],
        },
      },
      {
        id: 'allow-user-to-edit-own-profile',
        description: 'Users can edit their own profile',
        condition: {
          and: [
            { '==': [{ var: 'action.name' }, 'edit'] },
            { '==': [{ var: 'resource.type' }, 'profile'] },
            { '==': [{ var: 'user.id' }, { var: 'resource.ownerId' }] },
          ],
        },
      },
      {
        id: 'allow-view-public-reports',
        description: 'Anyone can view public reports',
        condition: {
          and: [
            { '==': [{ var: 'action.name' }, 'view'] },
            { '==': [{ var: 'resource.type' }, 'report'] },
            { '==': [{ var: 'resource.visibility' }, 'public'] },
          ],
        },
      },
    ];

    // Use Promise.all to create all policies concurrently before running tests
    await Promise.all(
      policies.map((p) =>
        server.inject({
          method: 'POST',
          url: '/policies',
          payload: p,
        }),
      ),
    );

    // Wait a moment to ensure background policy reload has completed.
    // In a real-world, high-concurrency test suite, you might use a more deterministic
    // mechanism, but for this scope, a small delay is sufficient and simple.
    await new Promise((resolve) => setTimeout(resolve, 50));

    t.test('should allow admin to read a document', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'user-123', role: 'admin' },
            action: { name: 'read' },
            resource: { type: 'document', id: 'doc-abc' },
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'allow', 'decision should be "allow"');
      t.equal(payload.matchedPolicyId, 'allow-admins-to-read-docs', 'should match the correct policy');
    });

    t.test('should deny non-admin reading a document', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'user-456', role: 'guest' },
            action: { name: 'read' },
            resource: { type: 'document', id: 'doc-abc' },
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'deny', 'decision should be "deny"');
      t.equal(payload.matchedPolicyId, null, 'should not match any policy');
      t.match(payload.reasons[0], /No policy explicitly allowed/, 'should have a default deny reason');
    });

    t.test('should allow user to edit their own profile', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'user-789' },
            action: { name: 'edit' },
            resource: { type: 'profile', ownerId: 'user-789' },
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'allow', 'decision should be "allow"');
      t.equal(payload.matchedPolicyId, 'allow-user-to-edit-own-profile', 'should match the ownership policy');
    });

    t.test('should deny user from editing another user\'s profile', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'user-789' },
            action: { name: 'edit' },
            resource: { type: 'profile', ownerId: 'user-000' }, // Different owner
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'deny', 'decision should be "deny"');
      t.equal(payload.matchedPolicyId, null, 'should not match any policy');
    });

    t.test('should allow viewing a public report', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'any-user', role: 'guest' }, // User role doesn't matter here
            action: { name: 'view' },
            resource: { type: 'report', visibility: 'public' },
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'allow', 'decision should be "allow"');
      t.equal(payload.matchedPolicyId, 'allow-view-public-reports', 'should match the public report policy');
    });

    t.test('should deny viewing a private report', async (t) => {
      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: {
            user: { id: 'any-user', role: 'guest' },
            action: { name: 'view' },
            resource: { type: 'report', visibility: 'private' }, // Not public
          },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'deny', 'decision should be "deny"');
      t.equal(payload.matchedPolicyId, null, 'should not match any policy');
    });

    t.test('should deny by default if no policies exist', async (t) => {
      // Clear all policies for this specific sub-test
      await memoryStore.disconnect();
      await memoryStore.connect();
      await policyStore.reloadPolicies();

      const response = await server.inject({
        method: 'POST',
        url: '/authorize',
        payload: {
          context: { user: { role: 'admin' } },
        },
      });
      t.equal(response.statusCode, 200, 'should return 200');
      const payload = response.json();
      t.equal(payload.decision, 'deny', 'decision should be "deny"');
      t.match(payload.reasons[0], /No policies were available/, 'should have a reason for no policies');
    });
  });
});