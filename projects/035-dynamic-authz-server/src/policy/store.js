/**
 * @file src/policy/store.js
 * @description Manages the lifecycle of policies, including caching. It handles
 * loading policies from storage, providing a fast read-path for the engine,
 * and orchestrating hot-reloads on updates.
 */

import logger from '../utils/logger.js';
import storage from '../storage/memory-store.js';

/**
 * A private, module-level cache to hold the active policy set in memory.
 * This is an array of all policy objects, optimized for fast iteration by the engine.
 * It is initialized as `null` to indicate that it hasn't been loaded yet.
 * @type {Array<object> | null}
 */
let policyCache = null;

/**
 * A read-write lock state to prevent race conditions during cache reloads.
 * - `false`: The lock is free.
 * - `true`: A reload is in progress, and subsequent reload requests should wait.
 * @type {boolean}
 */
let isReloading = false;

/**
 * Initializes the policy store by performing the first full load of policies
 * from the persistent storage into the in-memory cache.
 * This function should be called once at application startup.
 *
 * @returns {Promise<void>} A promise that resolves when the initial cache load is complete.
 * @throws {Error} If the initial load from storage fails, which is a critical startup error.
 */
async function initialize() {
  logger.info('Initializing policy store and performing initial cache load...');
  try {
    await reloadPolicies();
    logger.info(`Policy store initialized successfully. ${policyCache?.length ?? 0} policies loaded into cache.`);
  } catch (error) {
    logger.fatal({ err: error }, 'Fatal: Initial policy load failed. The server cannot operate without policies.');
    // In a real application, this should trigger a graceful shutdown.
    // Re-throwing ensures the startup process is halted.
    throw new Error('Failed to initialize policy store.', { cause: error });
  }
}

/**
 * Fetches all policies from the storage backend and atomically replaces the
 * in-memory cache. This is the "hot-reload" mechanism.
 *
 * It uses a simple locking mechanism (`isReloading`) to prevent concurrent reloads,
 * ensuring that only one reload operation happens at a time. If a reload is
- * already in progress, subsequent calls will log a message and return without
 * action.
 *
 * @returns {Promise<void>} A promise that resolves when the cache has been updated.
 */
async function reloadPolicies() {
  if (isReloading) {
    logger.warn('Policy reload requested but another reload is already in progress. Skipping.');
    return;
  }

  isReloading = true;
  logger.info('Starting policy cache reload from storage...');

  try {
    const allPolicies = await storage.getAll();

    // The new cache is an array of policy objects.
    // Sorting by ID provides a predictable evaluation order, which can be useful
    // for debugging and ensuring consistent behavior, though the engine itself
    // doesn't require a specific order.
    allPolicies.sort((a, b) => a.id.localeCompare(b.id));

    // Atomically swap the cache. This ensures that any concurrent authorization
    // requests will use either the complete old cache or the complete new one,
    // never a partially constructed one.
    policyCache = allPolicies;

    logger.info({ count: policyCache.length }, 'Policy cache reloaded successfully.');
  } catch (error) {
    // If the reload fails, we keep the old cache to maintain service availability.
    logger.error({ err: error }, 'Failed to reload policies from storage. The existing cache (if any) will be used.');
    throw error; // Re-throw to let the caller know the operation failed.
  } finally {
    // Always release the lock, whether the reload succeeded or failed.
    isReloading = false;
  }
}

/**
 * Retrieves the current set of policies from the in-memory cache.
 * This provides a high-performance read path for the authorization engine.
 *
 * It returns a deep clone of the cache to ensure that the engine or other
 * consumers cannot accidentally mutate the shared cache state.
 *
 * @returns {Array<object>} A deep clone of the array of policy objects.
 * @throws {Error} If the cache has not been initialized yet.
 */
function getPolicies() {
  if (policyCache === null) {
    // This indicates a severe logic error, as `initialize` should be called on startup.
    logger.error('Attempted to get policies before the cache was initialized.');
    throw new Error('Policy cache is not available. The policy store may not have been initialized.');
  }

  // Use structuredClone for a deep, performant copy. This prevents consumers
  // from modifying the master cache array or the objects within it.
  return structuredClone(policyCache);
}

/**
 * Creates a new policy.
 * It saves the policy to the persistent storage and then triggers a hot-reload
 * of the in-memory cache to make the change effective immediately.
 *
 * @param {object} policyDocument - The policy object to create.
 * @returns {Promise<object>} A promise that resolves with the newly created policy object.
 */
async function createPolicy(policyDocument) {
  const newPolicy = await storage.set(policyDocument.id, policyDocument);
  logger.info({ policyId: newPolicy.id }, 'New policy created in storage.');

  // Trigger a non-blocking hot-reload. We don't await it because we want to
  // return the API response quickly. The reload will happen in the background.
  // We catch potential errors to prevent unhandled promise rejections.
  reloadPolicies().catch(err => {
    logger.error({ err, policyId: newPolicy.id }, 'Background policy reload failed after creation.');
  });

  return newPolicy;
}

/**
 * Retrieves a single policy by its ID directly from the storage backend.
 * Note: This reads from storage, not the cache, to ensure the caller gets
 * the most up-to-date persisted version.
 *
 * @param {string} id - The ID of the policy to retrieve.
 * @returns {Promise<object|null>} The policy object or null if not found.
 */
async function getPolicyById(id) {
  return storage.get(id);
}

/**
 * Updates an existing policy.
 * It saves the updated policy to storage and triggers a cache hot-reload.
 *
 * @param {string} id - The ID of the policy to update.
 * @param {object} policyUpdatePayload - An object containing the fields to update.
 * @returns {Promise<object>} The fully updated policy object.
 */
async function updatePolicy(id, policyUpdatePayload) {
  const existingPolicy = await storage.get(id);
  if (!existingPolicy) {
    return null; // Or throw an error, depending on API design. Returning null is common for "not found".
  }

  // Merge the updates onto the existing policy object.
  const updatedPolicyDocument = { ...existingPolicy, ...policyUpdatePayload };

  const savedPolicy = await storage.set(id, updatedPolicyDocument);
  logger.info({ policyId: id }, 'Policy updated in storage.');

  // Trigger a background hot-reload.
  reloadPolicies().catch(err => {
    logger.error({ err, policyId: id }, 'Background policy reload failed after update.');
  });

  return savedPolicy;
}

/**
 * Deletes a policy by its ID.
 * It removes the policy from storage and triggers a cache hot-reload.
 *
 * @param {string} id - The ID of the policy to delete.
 * @returns {Promise<boolean>} True if the policy was deleted, false if not found.
 */
async function deletePolicy(id) {
  const wasDeleted = await storage.remove(id);

  if (wasDeleted) {
    logger.info({ policyId: id }, 'Policy deleted from storage.');
    // Trigger a background hot-reload to remove the policy from the active set.
    reloadPolicies().catch(err => {
      logger.error({ err, policyId: id }, 'Background policy reload failed after deletion.');
    });
  }

  return wasDeleted;
}

/**
 * Retrieves all policies directly from the storage backend.
 * Useful for management APIs that need a complete, persisted list.
 *
 * @returns {Promise<Array<object>>} An array of all policy objects from storage.
 */
async function getAllPoliciesFromStorage() {
  return storage.getAll();
}

export const policyStore = {
  initialize,
  reloadPolicies,
  getPolicies,
  createPolicy,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  getAllPoliciesFromStorage,
};

export default policyStore;