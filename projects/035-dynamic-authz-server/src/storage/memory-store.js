/**
 * @file src/storage/memory-store.js
 * @description A simple, asynchronous in-memory key-value store for policy documents.
 *
 * This module provides a basic storage mechanism that keeps all policies in a
 * JavaScript Map. It's designed to be a lightweight, zero-dependency solution
 * suitable for development, testing, and small-scale deployments where data
 * persistence across server restarts is not required.
 *
 * The interface is designed to be "storage-agnostic," meaning it could be
 * replaced by a more robust backend (e.g., Redis, a database) without changing
 * the calling code in `src/policy/store.js`. All methods are async to mimic
 * the I/O-bound nature of a real database.
 */

import logger from '../utils/logger.js';

/**
 * A Map instance to hold the policy documents in memory.
 * The key is the policy ID (string), and the value is the policy object.
 * This is a private module-level variable, not exposed directly.
 * @type {Map<string, object>}
 */
const store = new Map();

/**
 * Initializes the memory store.
 * For this simple implementation, it just logs a message. In a more complex
 * store (e.g., a database), this is where a connection would be established.
 *
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 */
async function connect() {
  logger.info('In-memory policy store initialized.');
  // No actual connection needed, so we resolve immediately.
  return Promise.resolve();
}

/**
 * Disconnects from the memory store.
 * For this implementation, it clears the in-memory map and logs a message.
 *
 * @returns {Promise<void>} A promise that resolves when disconnection is complete.
 */
async function disconnect() {
  store.clear();
  logger.info('In-memory policy store has been cleared and disconnected.');
  // No actual disconnection needed, so we resolve immediately.
  return Promise.resolve();
}

/**
 * Retrieves a single policy document by its ID.
 *
 * @param {string} id - The unique identifier of the policy to retrieve.
 * @returns {Promise<object|null>} A promise that resolves with the policy object
 *   if found, or null if no policy with the given ID exists. The returned object
 *   is a deep clone to prevent direct mutation of the stored data.
 */
async function get(id) {
  if (!id) {
    logger.warn('Attempted to get a policy with a null or empty ID.');
    return null;
  }

  const policy = store.get(id);

  if (!policy) {
    logger.trace({ policyId: id }, 'Policy not found in memory store.');
    return null;
  }

  // Return a deep clone to enforce immutability. Callers should not be able
  // to modify the object in the store directly. `structuredClone` is a
  // modern, efficient way to do this.
  return structuredClone(policy);
}

/**
 * Saves or updates a policy document in the store.
 * If a policy with the same ID already exists, it will be overwritten.
 *
 * @param {string} id - The unique identifier of the policy to save.
 * @param {object} policyDocument - The policy object to store.
 * @returns {Promise<object>} A promise that resolves with the saved policy object.
 *   The returned object is a deep clone.
 * @throws {Error} If the id or policyDocument is invalid.
 */
async function set(id, policyDocument) {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid or missing ID provided for set operation.');
  }
  if (!policyDocument || typeof policyDocument !== 'object') {
    throw new Error(`Invalid or missing policy document for ID: ${id}`);
  }

  // Store a deep clone to ensure the internal state isn't affected by
  // external modifications to the original object after it's been set.
  const policyToStore = structuredClone(policyDocument);

  store.set(id, policyToStore);
  logger.debug({ policyId: id }, 'Policy saved or updated in memory store.');

  // Return a clone of the stored object, consistent with the `get` method.
  return structuredClone(policyToStore);
}

/**
 * Deletes a policy document from the store by its ID.
 *
 * @param {string} id - The unique identifier of the policy to delete.
 * @returns {Promise<boolean>} A promise that resolves to `true` if a policy was
 *   found and deleted, or `false` if no policy with the given ID existed.
 */
async function remove(id) {
  if (!id) {
    logger.warn('Attempted to remove a policy with a null or empty ID.');
    return false;
  }

  const wasDeleted = store.delete(id);

  if (wasDeleted) {
    logger.debug({ policyId: id }, 'Policy removed from memory store.');
  } else {
    logger.warn({ policyId: id }, 'Attempted to remove a non-existent policy.');
  }

  return wasDeleted;
}

/**
 * Retrieves all policy documents currently in the store.
 *
 * @returns {Promise<Array<object>>} A promise that resolves with an array of all
 *   policy objects. The array and its contents are deep clones.
 */
async function getAll() {
  // `Array.from(store.values())` creates a new array of the stored policies.
  // `structuredClone` then ensures a deep copy of the entire structure,
  // preventing any possibility of mutating the store's internal state.
  const allPolicies = structuredClone(Array.from(store.values()));
  logger.debug({ count: allPolicies.length }, 'Retrieved all policies from memory store.');
  return allPolicies;
}

/**
 * A consistent storage interface for managing policy documents.
 * This object is exported so other modules can use the memory store
 * without being tightly coupled to its specific implementation.
 */
const memoryStore = {
  connect,
  disconnect,
  get,
  set,
  remove,
  getAll,
};

export default memoryStore;