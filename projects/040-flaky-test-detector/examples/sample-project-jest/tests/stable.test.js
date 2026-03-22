/**
 * @file examples/sample-project-jest/tests/stable.test.js
 * @description A collection of stable tests that are designed to pass consistently.
 * These tests are used to verify that the flaky test detector correctly identifies
 * tests with a 100% success rate as 'stable'.
 */

describe('Stable Test Suite', () => {
  // A basic synchronous test that always passes.
  test('should perform a simple synchronous addition correctly', () => {
    const sum = 1 + 1;
    expect(sum).toBe(2);
  });

  // A basic asynchronous test using async/await that resolves successfully.
  test('should resolve a promise successfully', async () => {
    const a = 1;
    const b = 2;
    const result = await Promise.resolve(a + b);
    expect(result).toBe(3);
  });

  // A test involving a timeout that completes well within its limit.
  test('should handle a short timeout without failing', async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await delay(10); // A very short, predictable delay.
    expect(true).toBe(true);
  }, 500); // Jest timeout is 500ms, 10ms is safe.

  // A test checking object properties.
  describe('Object Property Checks', () => {
    it('should have the correct properties on a simple object', () => {
      const user = {
        id: 1,
        name: 'John Doe',
        role: 'user',
      };
      expect(user).toHaveProperty('id', 1);
      expect(user.name).toEqual('John Doe');
    });
  });

  // A test using array methods.
  test('should correctly filter an array', () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const evenNumbers = numbers.filter((n) => n % 2 === 0);
    expect(evenNumbers).toEqual([2, 4, 6]);
    expect(evenNumbers).not.toContain(3);
  });
});