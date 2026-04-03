/**
 * Example test file for demonstrating http-mock-recorder with Jest.
 *
 * This file contains tests for a hypothetical `fetchUserProfile` function
 * that retrieves user data from an external API (JSONPlaceholder).
 *
 * To run these tests with the recorder:
 *
 * 1. Record Mode (first run):
 *    npx http-mock-recorder --record -- jest examples/with-jest/api.test.js
 *    This will execute the tests, make a real HTTP request, and save the
 *    response to a fixture file in `__http_mocks__/`.
 *
 * 2. Replay Mode (subsequent runs):
 *    npx http-mock-recorder jest examples/with-jest/api.test.js
 *    This will execute the tests using the recorded fixture, without making
 *    any real network calls. It will be much faster and will work offline.
 */

// A simple function that fetches user data from an external API.
// In a real application, this would be in a separate file (e.g., `src/api.js`).
const fetchUserProfile = async (userId) => {
  if (!userId || typeof userId !== 'number' || userId < 1) {
    throw new Error('A valid user ID (positive number) is required.');
  }

  try {
    const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    // In a real app, you might have more sophisticated error handling/logging.
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

// --- Jest Tests ---

describe('fetchUserProfile', () => {
  /**
   * This test demonstrates the successful retrieval of a user profile.
   * When run in 'record' mode, it will make a real HTTP request to:
   *   https://jsonplaceholder.typicode.com/users/1
   * The response will be saved as a JSON fixture.
   *
   * In 'replay' mode, the recorder will intercept this request and serve
   * the content from the fixture, ensuring a fast and deterministic test.
   */
  test('should fetch and return a user profile for a valid user ID', async () => {
    const userId = 1;
    const userProfile = await fetchUserProfile(userId);

    // Assertions to verify the structure and content of the returned data.
    // These assertions will pass in both record and replay modes.
    expect(userProfile).toBeDefined();
    expect(userProfile.id).toBe(userId);
    expect(userProfile.name).toBe('Leanne Graham');
    expect(userProfile.email).toBe('Sincere@april.biz');
    expect(userProfile).toHaveProperty('address');
    expect(userProfile.address.city).toBe('Gwenborough');
  });

  /**
   * This test demonstrates handling an API response that indicates a resource
   * was not found (HTTP 404).
   *
   * In 'record' mode, this will make a real request to a non-existent user ID
   * and record the resulting 404 response.
   *
   * In 'replay' mode, this ensures your application code correctly handles
   * the mocked 404 error provided by the fixture.
   */
  test('should throw an error when the user ID does not exist', async () => {
    const nonExistentUserId = 99999;

    // We expect the function to throw an error because the API will return a 404.
    // `expect.rejects` is the standard Jest way to test for async errors.
    await expect(fetchUserProfile(nonExistentUserId)).rejects.toThrow(
      'API request failed with status 404'
    );
  });

  /**
   * This test demonstrates input validation within the function itself,
   * before any HTTP request is made. This kind of test does not involve
   * network activity and therefore will not generate a fixture.
   * It's included to show a complete test suite.
   */
  test('should throw an error for an invalid user ID', async () => {
    // Test with various invalid inputs
    await expect(fetchUserProfile(-5)).rejects.toThrow('A valid user ID (positive number) is required.');
    await expect(fetchUserProfile(null)).rejects.toThrow('A valid user ID (positive number) is required.');
    await expect(fetchUserProfile('abc')).rejects.toThrow('A valid user ID (positive number) is required.');
  });
});