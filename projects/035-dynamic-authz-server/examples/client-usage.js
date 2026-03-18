/**
 * @file examples/client-usage.js
 * @description An example Node.js script demonstrating how a client application
 * would call the '/authorize' endpoint to check permissions before performing an action.
 *
 * This script simulates a service (e.g., a "documents" microservice) that needs
 * to verify user permissions before allowing actions like reading or updating a document.
 * It defines a helper function `isAllowed` that abstracts the call to the authorization server.
 *
 * To run this example:
 * 1. Make sure the authorization server is running (`npm run dev`).
 * 2. Run this script from the project root: `node examples/client-usage.js`
 *
 * The script will first create a set of example policies and then run several
 * authorization checks to demonstrate different scenarios (RBAC, ABAC, deny cases).
 */

import {
  env
} from 'node:process';

// The base URL of the running Dynamic Authorization Server.
// Can be overridden with the AUTHZ_SERVER_URL environment variable.
const AUTHZ_SERVER_URL = env.AUTHZ_SERVER_URL || 'http://127.0.0.1:3000';

/**
 * A client-side helper function to check for authorization.
 *
 * This function encapsulates the logic for calling the authorization server's
 * `/authorize` endpoint. It sends the user, resource, and action context and
 * returns a boolean indicating whether the action is permitted.
 *
 * In a real application, this function would be part of a shared library or
 * a middleware in your service framework.
 *
 * @param {object} context - The authorization context, including user, resource, etc.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the decision is 'allow', and `false` otherwise.
 */
export async function isAllowed(context) {
  const url = `${AUTHZ_SERVER_URL}/authorize`;
  console.log(`\n--- Checking permission for action: ${context.action} on resource: ${context.resource?.type} ---`);
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        context
      }),
    });

    if (!response.ok) {
      // Handle non-2xx responses, which indicate a server-side issue.
      const errorBody = await response.json().catch(() => ({
        message: 'Failed to parse error response'
      }));
      console.error(`Error: Authorization server returned status ${response.status}.`);
      console.error('Details:', errorBody.message || 'No details provided.');
      return false;
    }

    const {
      decision,
      matchedPolicyId,
      reasons
    } = await response.json();
    console.log(`Decision: ${decision.toUpperCase()}`);
    console.log(`Reason: ${reasons.join(', ')}`);
    if (matchedPolicyId) {
      console.log(`Matched Policy: ${matchedPolicyId}`);
    }

    return decision === 'allow';
  } catch (error) {
    console.error('Error: Failed to connect to the authorization server.', error.message);
    // Fail-closed: If the authorization server is unreachable, deny access.
    return false;
  }
}

/**
 * A utility function to create or update policies on the authorization server.
 * This is used for setting up the initial state for the demonstration.
 *
 * @param {object} policy - The policy document to create or update.
 * @returns {Promise<void>}
 */
async function setupPolicy(policy) {
  const url = `${AUTHZ_SERVER_URL}/policies`;
  try {
    // First, try to create the policy.
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(policy),
    });

    // If it already exists (409 Conflict), update it instead.
    if (response.status === 409) {
      console.log(`Policy '${policy.id}' already exists. Updating it.`);
      response = await fetch(`${url}/${policy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: policy.description,
          condition: policy.condition
        }),
      });
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(`Failed to setup policy '${policy.id}'. Status: ${response.status}, Body: ${JSON.stringify(errorBody)}`);
    }

    console.log(`Successfully set up policy: '${policy.id}'`);
  } catch (error) {
    console.error(`Fatal: Could not set up policies. Is the server running at ${AUTHZ_SERVER_URL}?`);
    console.error(error.message);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

/**
 * Main demonstration function.
 * Sets up example policies and then runs several authorization checks.
 */
async function main() {
  console.log('--- Setting up example policies on the authorization server ---');

  // Policy 1: RBAC - Admins can do anything.
  await setupPolicy({
    id: 'admin-can-do-anything',
    description: 'Allows users with the "admin" role to perform any action.',
    condition: {
      'in': ['admin', {
        var: 'user.roles'
      }]
    },
  });

  // Policy 2: RBAC - Editors can edit documents.
  await setupPolicy({
    id: 'editor-can-edit-document',
    description: 'Allows users with the "editor" role to edit resources of type "document".',
    condition: {
      'and': [{
        'in': ['editor', {
          var: 'user.roles'
        }]
      }, {
        '==': [{
          var: 'action'
        }, 'edit']
      }, {
        '==': [{
          var: 'resource.type'
        }, 'document']
      }, ],
    },
  });

  // Policy 3: ABAC - Users can read their own documents.
  await setupPolicy({
    id: 'user-can-read-own-document',
    description: 'Allows any user to read a document if their user ID matches the document\'s ownerId.',
    condition: {
      'and': [{
        '==': [{
          var: 'action'
        }, 'read']
      }, {
        '==': [{
          var: 'resource.type'
        }, 'document']
      }, {
        '==': [{
          var: 'user.id'
        }, {
          var: 'resource.ownerId'
        }]
      }, ],
    },
  });

  // Policy 4: ABAC - Deny access to documents in the "archived" state, unless user is an admin.
  // This demonstrates a more complex rule that overrides others.
  // Note: json-logic doesn't have an explicit "deny". We achieve this by ensuring the condition
  // for allowing access is NOT met. The engine is "deny-by-default".
  // A better approach is to have ordered policies, but for this example, we'll add it to other conditions.
  // For simplicity, we will handle this logic in the client checks. A real policy might be more complex.
  // Let's create a policy that explicitly allows reading archived documents for admins.
  await setupPolicy({
    id: 'admin-can-read-archived',
    description: 'Allows admins to read documents even if they are archived.',
    condition: {
      'and': [{
        'in': ['admin', {
          var: 'user.roles'
        }]
      }, {
        '==': [{
          var: 'action'
        }, 'read']
      }, {
        '==': [{
          var: 'resource.status'
        }, 'archived']
      }, ],
    },
  });


  console.log('\n--- Running Authorization Scenarios ---');

  // Scenario 1: An admin user (Alice) tries to delete a document.
  // Expected: ALLOW (due to 'admin-can-do-anything' policy)
  let allowed = await isAllowed({
    user: {
      id: 'user-1',
      name: 'Alice',
      roles: ['admin', 'editor']
    },
    action: 'delete',
    resource: {
      type: 'document',
      id: 'doc-123'
    },
  });
  console.log(`--> Final result: Alice ${allowed ? 'CAN' : 'CANNOT'} delete the document.`);

  // Scenario 2: An editor (Bob) tries to edit a document.
  // Expected: ALLOW (due to 'editor-can-edit-document' policy)
  allowed = await isAllowed({
    user: {
      id: 'user-2',
      name: 'Bob',
      roles: ['editor']
    },
    action: 'edit',
    resource: {
      type: 'document',
      id: 'doc-456'
    },
  });
  console.log(`--> Final result: Bob ${allowed ? 'CAN' : 'CANNOT'} edit the document.`);

  // Scenario 3: An editor (Bob) tries to delete a document.
  // Expected: DENY (no policy allows this)
  allowed = await isAllowed({
    user: {
      id: 'user-2',
      name: 'Bob',
      roles: ['editor']
    },
    action: 'delete',
    resource: {
      type: 'document',
      id: 'doc-456'
    },
  });
  console.log(`--> Final result: Bob ${allowed ? 'CAN' : 'CANNOT'} delete the document.`);

  // Scenario 4: A regular user (Charlie) tries to read their own document.
  // Expected: ALLOW (due to 'user-can-read-own-document' ABAC policy)
  allowed = await isAllowed({
    user: {
      id: 'user-3',
      name: 'Charlie',
      roles: ['viewer']
    },
    action: 'read',
    resource: {
      type: 'document',
      id: 'doc-789',
      ownerId: 'user-3'
    },
  });
  console.log(`--> Final result: Charlie ${allowed ? 'CAN' : 'CANNOT'} read their own document.`);

  // Scenario 5: A regular user (Charlie) tries to read someone else's document.
  // Expected: DENY (ABAC condition user.id == resource.ownerId fails)
  allowed = await isAllowed({
    user: {
      id: 'user-3',
      name: 'Charlie',
      roles: ['viewer']
    },
    action: 'read',
    resource: {
      type: 'document',
      id: 'doc-456',
      ownerId: 'user-2'
    }, // Bob's document
  });
  console.log(`--> Final result: Charlie ${allowed ? 'CAN' : 'CANNOT'} read Bob's document.`);

  // Scenario 6: An editor (Bob) tries to read an archived document.
  // Expected: DENY (no policy allows non-admins to read archived documents)
  allowed = await isAllowed({
    user: {
      id: 'user-2',
      name: 'Bob',
      roles: ['editor']
    },
    action: 'read',
    resource: {
      type: 'document',
      id: 'doc-999',
      ownerId: 'user-2',
      status: 'archived'
    },
  });
  console.log(`--> Final result: Bob ${allowed ? 'CAN' : 'CANNOT'} read the archived document.`);

  // Scenario 7: An admin (Alice) tries to read an archived document.
  // Expected: ALLOW (due to 'admin-can-read-archived' and 'admin-can-do-anything')
  allowed = await isAllowed({
    user: {
      id: 'user-1',
      name: 'Alice',
      roles: ['admin']
    },
    action: 'read',
    resource: {
      type: 'document',
      id: 'doc-999',
      ownerId: 'user-2',
      status: 'archived'
    },
  });
  console.log(`--> Final result: Alice ${allowed ? 'CAN' : 'CANNOT'} read the archived document.`);
}

// This allows the script to be run directly from the command line.
if (import.meta.url.startsWith('file:') && process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}