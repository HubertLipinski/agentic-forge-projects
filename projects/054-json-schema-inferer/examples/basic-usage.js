/**
 * @file examples/basic-usage.js
 * @description Demonstrates the programmatic usage of the json-schema-inferer library.
 * This example shows how to generate a JSON Schema from both a single object
 * and an array of objects.
 */

// In a real project, you would use: import { infer } from 'json-schema-inferer';
// For this example, we import directly from the source file.
import { infer } from '../src/index.js';

/**
 * A sample user object.
 * @type {object}
 */
const singleUser = {
  id: 1,
  name: 'John Doe',
  email: 'john.doe@example.com',
  isActive: true,
  lastLogin: '2024-07-29T10:00:00Z',
  profile: {
    age: 30,
    avatarUrl: 'https://example.com/avatar/johndoe.png',
  },
  roles: ['user', 'reader'],
};

/**
 * An array of user objects with slight variations.
 * - The 'email' property is missing in the second object, making it optional.
 * - The 'lastLogin' property is null in the third object, making its type [string, null].
 * - The 'profile' object is missing in the third object.
 * @type {object[]}
 */
const userArray = [
  {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    isActive: true,
    lastLogin: '2024-07-28T14:30:00Z',
    profile: {
      age: 28,
      avatarUrl: 'https://example.com/avatar/alice.png',
    },
    roles: ['admin', 'editor'],
  },
  {
    id: 2,
    name: 'Bob',
    // 'email' is intentionally omitted to demonstrate optional properties.
    isActive: false,
    lastLogin: '2024-07-27T09:00:00Z',
    profile: {
      age: 35,
      // 'avatarUrl' is null here.
      avatarUrl: null,
    },
    roles: ['editor'],
  },
  {
    id: 3,
    name: 'Charlie',
    email: 'charlie@example.com',
    isActive: true,
    // 'lastLogin' is null here.
    lastLogin: null,
    // 'profile' object is missing.
    roles: ['viewer'],
  },
];

/**
 * Main function to run the examples.
 */
async function main() {
  console.log('--- Example 1: Inferring schema from a single JSON object ---');
  try {
    const singleObjectSchema = infer(singleUser);
    console.log(JSON.stringify(singleObjectSchema, null, 2));
  } catch (error) {
    console.error('Failed to infer schema from single object:', error.message);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  console.log('--- Example 2: Inferring schema from an array of JSON objects ---');
  console.log('Note how the schema handles optional properties (like "email" and "profile")');
  console.log('and mixed types (like "lastLogin" which can be string or null).\n');
  try {
    const arraySchema = infer(userArray);
    console.log(JSON.stringify(arraySchema, null, 2));
  } catch (error) {
    console.error('Failed to infer schema from array:', error.message);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  console.log('--- Example 3: Handling invalid input ---');
  try {
    // This will throw a TypeError because the input is not an object or an array of objects.
    infer('just a string');
  } catch (error) {
    console.error(`Caught expected error: ${error.name} - ${error.message}`);
  }
}

// Run the main function.
main();