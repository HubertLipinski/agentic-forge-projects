/**
 * @fileoverview An example benchmark script for the Performance Impact Analyzer.
 *
 * This script demonstrates how to measure the performance of different operations
 * and log the results to standard output in a format that the analyzer can parse.
 *
 * It uses a simple, self-contained approach without external benchmarking libraries
 * like 'benchmark.js' to keep the example minimal and easy to understand.
 *
 * The key is to print metrics in a consistent, machine-readable format, like:
 * `Metric Name: 1234.56 ops/sec`
 *
 * This format allows the `.perf-impact-analyzer.json` configuration to use a
 * simple regex to extract the numerical value.
 */

/**
 * A simple, synchronous, and CPU-intensive task to simulate a workload.
 * This function calculates a large number of Fibonacci numbers recursively.
 * It's intentionally inefficient to make performance differences measurable.
 * @param {number} n - The Fibonacci number to calculate.
 * @returns {number} The nth Fibonacci number.
 */
function fibonacci(n) {
  if (n < 2) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

/**
 * An asynchronous task that simulates I/O-bound work, like a network request or file access.
 * @param {number} delay - The time to wait in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
function simulateIo(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Runs a benchmark for a given synchronous function.
 * It measures how many times the function can be executed in a fixed duration.
 *
 * @param {string} name - The name of the benchmark to be printed.
 * @param {function} fn - The synchronous function to benchmark.
 * @param {number} durationMs - The duration in milliseconds to run the benchmark.
 */
function benchmarkSync(name, fn, durationMs = 500) {
  const startTime = process.hrtime.bigint();
  const durationNs = BigInt(durationMs) * 1_000_000n;
  let operations = 0;

  while (process.hrtime.bigint() - startTime < durationNs) {
    fn();
    operations++;
  }

  const actualDurationSec = Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
  const opsPerSec = operations / actualDurationSec;

  // Log the result in a machine-readable format.
  // Example: "Fibonacci Calculation: 150.34 ops/sec"
  console.log(`${name}: ${opsPerSec.toFixed(2)} ops/sec`);
}

/**
 * Runs a benchmark for a given asynchronous function.
 * It measures the average time taken for the function to complete over several iterations.
 *
 * @param {string} name - The name of the benchmark to be printed.
 * @param {function} asyncFn - The asynchronous function to benchmark.
 * @param {number} iterations - The number of times to run the function.
 */
async function benchmarkAsync(name, asyncFn, iterations = 50) {
  const latencies = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await asyncFn();
    const end = process.hrtime.bigint();
    latencies.push(Number(end - start) / 1_000_000); // Convert nanoseconds to milliseconds
  }

  // Calculate p99 latency (99th percentile)
  latencies.sort((a, b) => a - b);
  const p99Index = Math.floor(latencies.length * 0.99) - 1;
  const p99Latency = latencies[Math.max(0, p99Index)];

  // Log the result in a machine-readable format.
  // Example: "Simulated I/O Latency: 12.34 ms (p99)"
  console.log(`${name}: ${p99Latency.toFixed(2)} ms (p99)`);
}

/**
 * The main function that executes all benchmarks.
 */
async function main() {
  console.log('Starting example benchmark suite...');

  try {
    // --- CPU-bound benchmark ---
    // This simulates a computationally intensive task.
    // A change in the fibonacci function's efficiency would be caught here.
    benchmarkSync('Fibonacci Calculation', () => fibonacci(20));

    // --- I/O-bound benchmark ---
    // This simulates an operation like a database query or API call.
    // A change in the simulated delay would be caught here.
    await benchmarkAsync('Simulated I/O Latency', () => simulateIo(10));

    console.log('Benchmark suite finished.');
  } catch (error) {
    console.error('An error occurred during the benchmark run:', error);
    // Exit with a non-zero code to signal failure to the analyzer tool.
    process.exit(1);
  }
}

// Run the main function.
main();