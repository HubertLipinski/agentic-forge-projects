/**
 * @file examples/source-file.js
 * @description An example JavaScript file with various JSDoc annotations to demonstrate the tool's capabilities.
 * This file is used as a test case and demonstration for the jsdoc-to-zod generator.
 */

/**
 * A simple @typedef for a primitive type alias.
 * This demonstrates how a simple type can be aliased and then used elsewhere.
 * @typedef {string} UserID - A unique identifier for a user.
 */

/**
 * A complex object defined using @typedef and @property.
 * This showcases nested properties, optional properties, and default values.
 *
 * @typedef {object} UserProfile
 * @property {UserID} id - The unique identifier for the user.
 * @property {string} name - The full name of the user.
 * @property {string} [email] - The user's email address. It's optional.
 * @property {number} age - The user's age in years.
 * @property {boolean} isActive - Whether the user's account is active.
 * @property {string[]} tags - An array of tags associated with the user.
 * @property {object} metadata - An object for storing arbitrary data.
 * @property {string} metadata.theme - The user's preferred theme.
 * @property {Date} metadata.lastLogin - The timestamp of the last login.
 */
export const UserProfile = {}; // The implementation is not needed for schema generation.

/**
 * A function that demonstrates various parameter types.
 * It includes primitives, optional parameters, arrays, and a custom typedef.
 *
 * @param {string} name - The name of the item to create.
 * @param {number} quantity - The starting quantity.
 * @param {boolean} [isAvailable=true] - Whether the item is available for purchase.
 * @param {string[]} categories - An array of category names.
 * @param {UserProfile} owner - The profile of the user who owns this item.
 * @returns {Promise<object>} A promise that resolves to the newly created item.
 */
export async function createItem(name, quantity, isAvailable = true, categories, owner) {
  // In a real application, you would have logic here.
  // For this example, we just return a mock object.
  const newItem = {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    name,
    quantity,
    isAvailable,
    categories,
    ownerId: owner.id,
    createdAt: new Date(),
  };
  return Promise.resolve(newItem);
}

/**
 * A function with a more complex return type defined inline.
 * This shows how to document a function that returns a structured object
 * without creating a separate @typedef.
 *
 * @param {string} userId - The ID of the user to fetch.
 * @returns {{id: string, name: string, settings: {theme: string, notifications: boolean}}} The user data object.
 */
export function getUserData(userId) {
  // Mock implementation.
  return {
    id: userId,
    name: 'Jane Doe',
    settings: {
      theme: 'dark',
      notifications: true,
    },
  };
}

/**
 * This function will not be processed because it lacks JSDoc annotations
 * that are relevant for schema generation (like @param, @returns, or @typedef).
 */
export function utilityFunction() {
  console.log('This function does something, but it has no schema.');
}

/**
 * A function demonstrating a union type for a parameter.
 * @param {string|number} input - An input that can be either a string or a number.
 */
export const processUnionType = (input) => {
  if (typeof input === 'string') {
    return input.toUpperCase();
  }
  return input * 2;
};

/**
 * @typedef {string|number|null} MaybeID
 * A type definition for a union that includes null.
 */
export const MaybeID = null;