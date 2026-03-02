/**
 * @file src/utils/rng.js
 * @description A simple seedable random number generator (RNG) utility.
 * This allows for reproducible results, which is crucial for features like
 * procedural map generation and replaying game sessions.
 */

/**
 * A simple, seedable pseudo-random number generator using the Mulberry32 algorithm.
 * This is not cryptographically secure, but it is fast, simple, and sufficient
 * for game development purposes where reproducibility is the primary goal.
 */
export class RNG {
  #seed;

  /**
   * Creates a new RNG instance.
   * @param {number} [seed] - The initial seed. If not provided, a seed will be
   * generated from the current time. The seed must be a non-zero integer.
   */
  constructor(seed) {
    this.setSeed(seed);
  }

  /**
   * Sets or resets the seed of the generator.
   * @param {number} [seed] - The seed to use. Must be a non-zero integer.
   * If not provided, a new seed is generated from the current time.
   */
  setSeed(seed) {
    let s = seed ?? Date.now();

    // Ensure the seed is a finite number.
    if (!Number.isFinite(s)) {
      console.warn(`[RNG] Invalid seed provided: ${s}. Using current time as fallback.`);
      s = Date.now();
    }

    // Ensure the seed is an integer.
    s = Math.trunc(s);

    // Mulberry32 algorithm requires a non-zero seed.
    if (s === 0) {
      // A common practice is to use a fallback value if the seed is 0.
      s = 1;
    }

    this.#seed = s;
  }

  /**
   * Generates the next pseudo-random number in the sequence.
   * This is the core of the Mulberry32 algorithm.
   * @returns {number} A pseudo-random floating-point number between 0 (inclusive) and 1 (exclusive).
   */
  next() {
    let t = (this.#seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer within a specified range.
   * @param {number} min - The minimum integer value (inclusive).
   * @param {number} max - The maximum integer value (exclusive).
   * @returns {number} A pseudo-random integer `i` such that `min <= i < max`.
   */
  nextInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('RNG.nextInt requires integer arguments for min and max.');
    }
    if (min >= max) {
      throw new Error('RNG.nextInt requires max to be strictly greater than min.');
    }
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Returns a pseudo-random floating-point number within a specified range.
   * @param {number} min - The minimum value (inclusive).
   * @param {number} max - The maximum value (exclusive).
   * @returns {number} A pseudo-random float `f` such that `min <= f < max`.
   */
  nextFloat(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('RNG.nextFloat requires finite number arguments for min and max.');
    }
    if (min >= max) {
        throw new Error('RNG.nextFloat requires max to be strictly greater than min.');
    }
    return this.next() * (max - min) + min;
  }

  /**
   * Selects a random element from an array.
   * @template T
   * @param {T[]} array - The array to choose from.
   * @returns {T | undefined} A randomly selected element from the array, or undefined if the array is empty.
   */
  choice(array) {
    if (!Array.isArray(array)) {
      throw new Error('RNG.choice requires an array as its argument.');
    }
    if (array.length === 0) {
      return undefined;
    }
    const index = this.nextInt(0, array.length);
    return array[index];
  }

  /**
   * Shuffles an array in-place using the Fisher-Yates (aka Knuth) shuffle algorithm.
   * The shuffle is deterministic based on the RNG's seed.
   * @template T
   * @param {T[]} array - The array to shuffle.
   * @returns {T[]} The same array, now shuffled.
   */
  shuffle(array) {
    if (!Array.isArray(array)) {
        throw new Error('RNG.shuffle requires an array as its argument.');
    }
    let currentIndex = array.length;
    let randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = this.nextInt(0, currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  }
}