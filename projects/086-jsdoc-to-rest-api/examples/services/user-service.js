/**
 * @file examples/services/user-service.js
 * @description A service for managing users. This file demonstrates how to use
 * JSDoc annotations to define API endpoints that can be processed by the
 * jsdoc-to-rest generator.
 */

// --- In-memory "database" for demonstration purposes ---

/**
 * A simple in-memory store for user data.
 * In a real application, this would be replaced with a database connection.
 * @type {Map<number, {id: number, name: string, email: string, role: 'admin'|'user'}>}
 */
const users = new Map([
  [1, { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' }],
  [2, { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' }],
  [3, { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' }],
]);

let nextUserId = 4;

/**
 * A custom error class for domain-specific errors, like "Not Found".
 * The generated API can use this to return appropriate HTTP status codes.
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// --- Service Functions ---

/**
 * Retrieves a list of all users. Supports optional filtering by role.
 *
 * @route {GET} /users
 * @param {{type: 'string', enum: ['admin', 'user']}} [role] - Optional role to filter users by.
 * @returns {200} {{type: 'array', items: {type: 'object'}}} An array of user objects.
 */
export async function getAllUsers({ role }) {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (role) {
    const filteredUsers = Array.from(users.values()).filter(
      (user) => user.role === role,
    );
    return filteredUsers;
  }
  return Array.from(users.values());
}

/**
 * Retrieves a single user by their numeric ID.
 *
 * @route {GET} /users/:id
 * @param {{type: 'integer', minimum: 1}} id - The unique identifier for the user.
 * @returns {200} {{type: 'object', properties: {id: {type: 'integer'}, name: {type: 'string'}, email: {type: 'string', format: 'email'}, role: {type: 'string'}}, required: ['id', 'name', 'email']}} The complete user object.
 * @throws {404} {Error} User not found.
 */
export async function getUserById(id) {
  // Simulate async database lookup
  await new Promise((resolve) => setTimeout(resolve, 20));

  const userId = Number(id);
  if (!users.has(userId)) {
    throw new NotFoundError(`User with ID ${userId} not found.`);
  }
  return users.get(userId);
}

/**
 * Creates a new user.
 * The request body must contain the user's name and email.
 *
 * @route {POST} /users
 * @param {{type: 'object', properties: {name: {type: 'string', minLength: 2}, email: {type: 'string', format: 'email'}}, required: ['name', 'email']}} body - The user data for creation.
 * @returns {201} {{type: 'object'}} The newly created user object, including their new ID.
 * @throws {400} {Error} Invalid user data provided.
 */
export async function createUser({ name, email }) {
  // Simulate async database insert
  await new Promise((resolve) => setTimeout(resolve, 100));

  const newUser = {
    id: nextUserId++,
    name,
    email,
    role: 'user', // Default role
  };

  users.set(newUser.id, newUser);
  return newUser;
}

/**
 * Updates an existing user's information.
 * This demonstrates a PATCH operation where only provided fields are updated.
 *
 * @route {PATCH} /users/:id
 * @param {{type: 'integer', minimum: 1}} id - The ID of the user to update.
 * @param {{type: 'object', properties: {name: {type: 'string', minLength: 2}, email: {type: 'string', format: 'email'}, role: {type: 'string', enum: ['admin', 'user']}}, minProperties: 1}} body - An object containing the fields to update.
 * @returns {200} {{type: 'object'}} The updated user object.
 * @throws {404} {Error} User not found.
 */
export async function updateUser(id, partialUser) {
  const userId = Number(id);
  if (!users.has(userId)) {
    throw new NotFoundError(`User with ID ${userId} not found.`);
  }

  const existingUser = users.get(userId);
  const updatedUser = { ...existingUser, ...partialUser };

  users.set(userId, updatedUser);
  return updatedUser;
}

/**
 * Deletes a user by their ID.
 *
 * @route {DELETE} /users/:id
 * @param {{type: 'integer', minimum: 1}} id - The ID of the user to delete.
 * @returns {204} {void} A successful response with no content.
 * @throws {404} {Error} User not found.
 */
export async function deleteUser(id) {
  // Simulate async database deletion
  await new Promise((resolve) => setTimeout(resolve, 80));

  const userId = Number(id);
  if (!users.has(userId)) {
    throw new NotFoundError(`User with ID ${userId} not found.`);
  }

  users.delete(userId);
  // No return value for a 204 response.
}