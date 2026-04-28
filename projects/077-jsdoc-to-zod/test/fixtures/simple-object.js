/**
 * @fileoverview A sample JavaScript file with JSDoc for testing basic object schema generation.
 * This fixture is used by the test suite to verify that the JSDoc-to-Zod generator
 * can correctly parse simple object definitions, function parameters, and return types.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * A simple user object.
 * @typedef {object} User
 * @property {string} id - The unique identifier for the user.
 * @property {string} name - The user's full name.
 * @property {number} age - The user's age in years.
 * @property {boolean} [isActive=true] - Whether the user account is active.
 * @property {string|null} email - The user's email address, which can be null.
 */

/**
 * Creates a new user in the system.
 *
 * @param {User} user - The user object to create.
 * @returns {User} The created user, usually with the ID assigned.
 */
export function createUser(user) {
	if (!user || typeof user.id !== 'string') {
		throw new Error('Invalid user object provided.');
	}
	// In a real implementation, this would save the user to a database.
	console.log(`Creating user: ${user.name}`);
	return {
		isActive: true,
		...user,
	};
}

/**
 * A constant representing a default configuration.
 * The `@type` tag here demonstrates another way to define an object structure
 * that the generator should be able to parse.
 *
 * @type {{port: number, host: string, enableHttps: boolean}}
 */
export const defaultConfig = {
	port: 8080,
	host: 'localhost',
	enableHttps: false,
};

/**
 * A function with only primitive parameters, no object.
 * @param {string} message - The message to log.
 * @param {number} [level=1] - The logging level.
 * @returns {void}
 */
export function logMessage(message, level = 1) {
	console.log(`[Level ${level}]: ${message}`);
}