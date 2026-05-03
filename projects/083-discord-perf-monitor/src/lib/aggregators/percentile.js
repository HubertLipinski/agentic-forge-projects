/**
 * @file src/lib/aggregators/percentile.js
 * @description A lightweight, streaming percentile estimator.
 *
 * This module implements a simplified, streaming algorithm for estimating percentiles
 * without storing all data points. It is inspired by algorithms like T-Digest but
 * uses a much simpler, fixed-bucket approach suitable for the bot's performance
 * monitoring needs, where extreme accuracy is less critical than low memory overhead
 * and good performance.
 *
 * The `PercentileEstimator` class maintains a set of pre-defined buckets (centroids)
 * and counts the number of observations that fall into the range of each bucket.
 * When a new value is added, it finds the closest bucket and updates its count and
 * weighted average. This allows for constant memory usage regardless of the number
 * of observations.
 *
 * The trade-off is precision. The accuracy of the estimation depends on the number
 * and distribution of the pre-defined buckets. For this use case (e.g., command latency),
 * we define more buckets for lower values where higher precision is desired.
 */

/**
 * Represents a single bucket (or centroid) in the percentile estimator.
 * Each bucket tracks a target value, the count of observations assigned to it,
 * and the mean of those observations.
 * @class
 */
class Bucket {
  /**
   * @param {number} value The target value (center) of this bucket.
   */
  constructor(value) {
    /**
     * The target value for this bucket.
     * @type {number}
     */
    this.value = value;
    /**
     * The number of observations that have been added to this bucket.
     * @type {number}
     */
    this.count = 0;
    /**
     * The running mean of all observations added to this bucket.
     * @type {number}
     */
    this.mean = 0;
  }

  /**
   * Adds a new observation to this bucket and updates its running mean.
   * @param {number} observation The value of the observation.
   */
  add(observation) {
    this.count++;
    // Welford's algorithm for a stable running mean
    this.mean += (observation - this.mean) / this.count;
  }

  /**
   * Resets the bucket to its initial state.
   */
  reset() {
    this.count = 0;
    this.mean = 0;
  }
}

/**
 * A streaming percentile estimator that uses a fixed set of buckets.
 * It provides constant memory usage and good performance for estimating
 * common percentiles like p50, p90, and p99.
 * @class
 */
export class PercentileEstimator {
  /**
   * Creates an instance of PercentileEstimator.
   * @param {number[]} [bucketValues] - An array of numbers defining the center points for the buckets.
   *   If not provided, a default set optimized for typical API/command latencies is used.
   */
  constructor(bucketValues) {
    const defaultBuckets = [
      // High resolution for low latencies (0-100ms)
      0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100,
      // Medium resolution (100ms - 1s)
      125, 150, 175, 200, 250, 300, 400, 500, 600, 700, 800, 900,
      // Lower resolution for high latencies (>1s)
      1000, 1250, 1500, 2000, 2500, 3000, 5000, 10000,
    ];

    const finalBucketValues = Array.isArray(bucketValues) && bucketValues.length > 0
      ? bucketValues
      : defaultBuckets;

    /**
     * The sorted list of buckets used for estimation.
     * @type {Bucket[]}
     * @private
     */
    this.buckets = finalBucketValues
      .sort((a, b) => a - b)
      .map(value => new Bucket(value));

    /**
     * The total number of observations added since the last reset.
     * @type {number}
     */
    this.totalCount = 0;
  }

  /**
   * Adds a new observation to the estimator.
   * The value is assigned to the closest bucket.
   * @param {number} value The observed value (e.g., latency in milliseconds).
   */
  add(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      // Silently ignore invalid inputs to avoid crashing performance-critical paths.
      return;
    }

    let closestBucket = this.buckets[0];
    let minDiff = Infinity;

    // Find the bucket with the center value closest to the observation.
    // This is a simple O(N) search; for a fixed, small number of buckets, it's very fast.
    for (const bucket of this.buckets) {
      const diff = Math.abs(bucket.value - value);
      if (diff < minDiff) {
        minDiff = diff;
        closestBucket = bucket;
      }
      // Since buckets are sorted, we can stop early if the bucket value
      // is much larger than the observation, as subsequent differences will only grow.
      if (bucket.value > value * 2 && diff > minDiff) {
        break;
      }
    }

    closestBucket.add(value);
    this.totalCount++;
  }

  /**
   * Estimates the value at a given percentile.
   * @param {number} q The percentile to estimate (a value between 0 and 1, e.g., 0.5 for p50).
   * @returns {number} The estimated value at the given percentile, or 0 if no data is available.
   */
  estimate(q) {
    if (this.totalCount === 0) {
      return 0;
    }

    // Clamp q to the valid range [0, 1]
    const targetQuantile = Math.max(0, Math.min(1, q));
    const targetRank = targetQuantile * this.totalCount;

    let cumulativeCount = 0;
    let prevBucket = null;

    for (const bucket of this.buckets) {
      const newCumulativeCount = cumulativeCount + bucket.count;

      if (newCumulativeCount >= targetRank) {
        // The target rank falls within this bucket.

        if (!prevBucket) {
          // The rank is in the very first bucket. Return its mean.
          return bucket.mean;
        }

        // Linear interpolation between the previous bucket's mean and this bucket's mean.
        const rankInBucket = targetRank - cumulativeCount;
        const bucketSize = bucket.count;

        if (bucketSize === 0) {
          // This can happen if the target rank is exactly on the boundary.
          // Return the mean of the previous bucket.
          return prevBucket.mean;
        }

        const fraction = rankInBucket / bucketSize;
        return prevBucket.mean + fraction * (bucket.mean - prevBucket.mean);
      }

      cumulativeCount = newCumulativeCount;
      prevBucket = bucket;
    }

    // If the loop completes, the rank is beyond the last bucket.
    // Return the mean of the last bucket that had any counts.
    return prevBucket?.mean ?? 0;
  }

  /**
   * Resets the estimator, clearing all observations and counts.
   */
  reset() {
    for (const bucket of this.buckets) {
      bucket.reset();
    }
    this.totalCount = 0;
  }

  /**
   * Merges another PercentileEstimator into this one.
   * This is useful for aggregating data from multiple sources.
   * Note: This assumes both estimators were created with identical bucket configurations.
   * @param {PercentileEstimator} other The other estimator to merge.
   */
  merge(other) {
    if (!(other instanceof PercentileEstimator) || other.buckets.length !== this.buckets.length) {
      // In a real-world scenario, you might throw an error.
      // Here, we'll log a warning and fail gracefully to avoid crashing.
      console.warn('Attempted to merge incompatible PercentileEstimators.');
      return;
    }

    for (let i = 0; i < this.buckets.length; i++) {
      const selfBucket = this.buckets[i];
      const otherBucket = other.buckets[i];

      if (otherBucket.count > 0) {
        const newTotalCount = selfBucket.count + otherBucket.count;
        // Combine means using a weighted average
        selfBucket.mean = (selfBucket.mean * selfBucket.count + otherBucket.mean * otherBucket.count) / newTotalCount;
        selfBucket.count = newTotalCount;
      }
    }

    this.totalCount += other.totalCount;
  }
}