/**
 * @fileoverview A sample JavaScript file with JSDoc for testing nested object and array schema generation.
 * This fixture is used by the test suite to verify that the JSDoc-to-Zod generator
 * can correctly parse complex, multi-level data structures.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * Represents a single tag.
 * @typedef {object} Tag
 * @property {number} id - The unique ID of the tag.
 * @property {string} name - The name of the tag.
 */

/**
 * Represents the author of a post.
 * This demonstrates a nested object.
 * @typedef {object} Author
 * @property {string} userId - The author's user ID.
 * @property {string} username - The author's public display name.
 */

/**
 * Represents a blog post with nested objects and arrays.
 * This is the main complex type for this test fixture.
 * @typedef {object} Post
 * @property {string} id - The unique identifier for the post.
 * @property {string} title - The title of the post.
 * @property {Author} author - The author of the post.
 * @property {string} content - The main body of the post.
 * @property {Tag[]} tags - An array of tags associated with the post.
 * @property {Array<{commenter: string, text: string}>} comments - An array of comments, demonstrating an inline object type within an array.
 * @property {object} metadata - A flexible metadata object.
 * @property {string} metadata.seoTitle - The title for SEO purposes.
 * @property {string} [metadata.seoDescription] - The optional description for SEO.
 * @property {Date} createdAt - The date the post was created.
 */

/**
 * A function that processes a blog post.
 * The parameters and return type use the complex `Post` type.
 *
 * @param {Post} post - The post to process.
 * @param {object} [options] - Optional processing settings.
 * @param {boolean} [options.publish=false] - If true, the post will be marked as published.
 * @param {string[]} [options.notify] - An array of user IDs to notify.
 * @returns {Post} The processed post.
 */
export function processPost(post, options = { publish: false }) {
	console.log(`Processing post: "${post.title}" by ${post.author.username}`);

	if (options.publish) {
		console.log('Publishing post...');
	}

	if (options.notify && options.notify.length > 0) {
		console.log(`Notifying users: ${options.notify.join(', ')}`);
	}

	// In a real scenario, we might modify the post or save it.
	// Here, we just return it as is.
	return post;
}

/**
 * A sample post object that conforms to the `Post` typedef.
 * This can be used for testing the `processPost` function.
 *
 * @type {Post}
 */
export const samplePost = {
	id: 'post-123',
	title: 'JSDoc to Zod: A Deep Dive',
	author: {
		userId: 'user-456',
		username: 'NodeFan',
	},
	content: 'This article explores how to generate Zod schemas from JSDoc...',
	tags: [
		{ id: 1, name: 'javascript' },
		{ id: 2, name: 'zod' },
	],
	comments: [
		{ commenter: 'user-789', text: 'Great article!' },
		{ commenter: 'user-012', text: 'Very useful, thanks.' },
	],
	metadata: {
		seoTitle: 'A Guide to JSDoc and Zod',
		seoDescription: 'Learn how to automatically generate Zod schemas.',
	},
	createdAt: new Date(),
};