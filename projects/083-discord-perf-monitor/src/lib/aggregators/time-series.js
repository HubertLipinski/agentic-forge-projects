/**
 * @file src/lib/aggregators/time-series.js
 * @description Manages time-bucketed data for metrics, using a rolling window.
 *
 * This module provides a `TimeSeries` class that is essential for tracking metrics
 * over time, such as requests per minute or events per second. It works by
 * dividing time into fixed-size buckets (e.g., one-second buckets) and
 * aggregating data within them.
 *
 * The key feature is its rolling window mechanism. It only stores a fixed number
 * of recent buckets (e.g., the last 60 one-second buckets for a one-minute view).
 * As time progresses, old buckets are automatically discarded, ensuring that the
 * memory usage remains constant and low, regardless of how long the application runs.
 *
 * This is highly efficient for calculating rates and totals over recent time periods
 * without needing to store an ever-growing list of timestamps.
 */

/**
 * A data structure for tracking numeric values over a rolling time window.
 * It uses a circular array of time-based buckets to store data efficiently.
 *
 * @class
 */
export class TimeSeries {
  /**
   * Creates an instance of TimeSeries.
   *
   * @param {object} options - Configuration options for the time series.
   * @param {number} [options.bucketSizeMs=1000] - The duration of each time bucket in milliseconds (e.g., 1000 for 1-second buckets).
   * @param {number} [options.windowSize=60] - The number of buckets to keep in the rolling window (e.g., 60 for a 60-second window).
   */
  constructor({ bucketSizeMs = 1000, windowSize = 60 } = {}) {
    if (typeof bucketSizeMs !== 'number' || bucketSizeMs <= 0) {
      throw new Error('bucketSizeMs must be a positive number.');
    }
    if (typeof windowSize !== 'number' || !Number.isInteger(windowSize) || windowSize <= 0) {
      throw new Error('windowSize must be a positive integer.');
    }

    /**
     * The duration of each time bucket in milliseconds.
     * @type {number}
     * @private
     */
    this.bucketSizeMs = bucketSizeMs;

    /**
     * The number of buckets to maintain in the rolling window.
     * @type {number}
     * @private
     */
    this.windowSize = windowSize;

    /**
     * The total duration of the time series window in milliseconds.
     * @type {number}
     */
    this.windowDurationMs = bucketSizeMs * windowSize;

    /**
     * A circular array holding the data for each bucket. Each element is a number
     * representing the aggregated value for that bucket's time slice.
     * @type {number[]}
     * @private
     */
    this.buckets = new Array(windowSize).fill(0);

    /**
     * The timestamp of the most recently updated bucket, normalized to the start
     * of that bucket's time interval. This is used to determine which buckets are
     * outdated and need to be cleared.
     * @type {number}
     * @private
     */
    this.lastBucketTimestamp = 0;
  }

  /**
   * Gets the current time from the system. Can be mocked for testing.
   * @returns {number} The current timestamp in milliseconds.
   * @private
   */
  _now() {
    return Date.now();
  }

  /**
   * Calculates the bucket index for a given timestamp.
   * The index wraps around the circular array.
   * @param {number} timestamp - The timestamp in milliseconds.
   * @returns {number} The index in the `buckets` array.
   * @private
   */
  _getBucketIndex(timestamp) {
    const bucketNumber = Math.floor(timestamp / this.bucketSizeMs);
    return bucketNumber % this.windowSize;
  }

  /**
   * Clears expired buckets between the last known update and the current time.
   * This is the core of the rolling window mechanism. It identifies buckets
   * that are now outside the `windowSize` and resets their values to zero.
   * @param {number} now - The current timestamp in milliseconds.
   * @private
   */
  _clearExpiredBuckets(now) {
    const currentBucketTimestamp = Math.floor(now / this.bucketSizeMs) * this.bucketSizeMs;

    if (this.lastBucketTimestamp === 0) {
      // First-time initialization
      this.lastBucketTimestamp = currentBucketTimestamp;
      return;
    }

    const timeElapsed = now - this.lastBucketTimestamp;

    // If the elapsed time is greater than the entire window, all buckets are stale.
    // Reset them all for efficiency instead of iterating.
    if (timeElapsed >= this.windowDurationMs) {
      this.buckets.fill(0);
      this.lastBucketTimestamp = currentBucketTimestamp;
      return;
    }

    // Iterate from the last known bucket time to the current bucket time,
    // clearing any buckets we've passed.
    let timestamp = this.lastBucketTimestamp + this.bucketSizeMs;
    while (timestamp <= currentBucketTimestamp) {
      const indexToClear = this._getBucketIndex(timestamp);
      this.buckets[indexToClear] = 0;
      timestamp += this.bucketSizeMs;
    }

    this.lastBucketTimestamp = currentBucketTimestamp;
  }

  /**
   * Adds a value to the time series. The value is added to the bucket
   * corresponding to the current time.
   * @param {number} value - The numeric value to add. Defaults to 1 for simple counting.
   */
  add(value = 1) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      // Silently ignore invalid values to prevent errors in hot paths.
      return;
    }

    const now = this._now();
    this._clearExpiredBuckets(now);

    const index = this._getBucketIndex(now);
    this.buckets[index] += value;
  }

  /**
   * Calculates the sum of all values within the current rolling window.
   * This represents the total count or sum over the configured duration
   * (e.g., total requests in the last 60 seconds).
   * @returns {number} The total sum of values in the window.
   */
  sum() {
    // Ensure the view is up-to-date by clearing any buckets that may have
    // expired since the last `add` operation.
    this._clearExpiredBuckets(this._now());

    // Summing a small, fixed-size array is very fast.
    return this.buckets.reduce((acc, val) => acc + val, 0);
  }

  /**
   * Calculates the average rate of events per second over the window.
   * @returns {number} The calculated rate (events/sec).
   */
  ratePerSecond() {
    const total = this.sum();
    const windowSeconds = this.windowDurationMs / 1000;
    if (windowSeconds === 0) {
      return 0;
    }
    return total / windowSeconds;
  }

  /**
   * Resets the time series, clearing all buckets and resetting the internal state.
   */
  reset() {
    this.buckets.fill(0);
    this.lastBucketTimestamp = 0;
  }
}