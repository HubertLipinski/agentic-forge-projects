/**
 * @file examples/sample-project-jest/tests/flaky.test.js
 * @description A test file containing a deliberately flaky test that fails randomly.
 * This is used to demonstrate and test the `flaky-test-detector` tool.
 */

describe('Flaky Test Suite', () => {
  /**
   * This test is designed to be flaky. It has a 50% chance of passing and a 50% chance of failing.
   * The flaky-test-detector should identify this test as 'flaky' because its success rate
   * will be approximately 50% over multiple runs, which is neither 100% (stable) nor 0% (failure).
   */
  test('should fail randomly, demonstrating flakiness', () => {
    // Generate a random number between 0 and 1.
    const randomValue = Math.random();

    // The test will pass if the random number is greater than 0.5, and fail otherwise.
    // This creates an approximate 50/50 chance of passing or failing on each run.
    expect(randomValue).toBeGreaterThan(0.5);
  });

  /**
   * This is another example of a flaky test, this time simulating a race condition
   * or an unreliable asynchronous operation.
   */
  test('should sometimes fail due to a simulated race condition', async () => {
    const operationTimeout = 50; // The maximum time our operation should take.
    const randomDelay = Math.random() * 100; // A random delay up to 100ms.

    const unreliableOperation = () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve('Operation completed');
        }, randomDelay);
      });

    await unreliableOperation();

    // The expectation is that the operation's delay is less than the timeout.
    // This will fail whenever `randomDelay` is greater than `operationTimeout`.
    expect(randomDelay).toBeLessThan(operationTimeout);
  });

  /**
   * This test will always fail. The detector should classify it as a 'failure'.
   * It's included to show the difference between a flaky test and a consistently failing one.
   */
  test('should fail consistently', () => {
    expect(false).toBe(true);
  });
});