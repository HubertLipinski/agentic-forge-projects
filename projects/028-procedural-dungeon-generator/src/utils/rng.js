/**
 * @file src/utils/rng.js
 * @description A seedable pseudo-random number generator (PRNG) utility.
 * This ensures that dungeon generation can be deterministic and reproducible.
 */

/**
 * A simple, seedable pseudo-random number generator using the Mulberry32 algorithm.
 *
 * This class allows for the creation of a deterministic sequence of random numbers
 * based on an initial seed. This is essential for generating reproducible dungeons.
 * If no seed is provided, it will be initialized with a value based on the
 * current timestamp, resulting in non-deterministic behavior.
 *
 * The Mulberry32 algorithm is chosen for its simplicity, good distribution, and
 * fast performance, making it suitable for procedural generation tasks.
 *
 * @see {@link https://gist.github.com/tommyettinger/46a874533244883189143505d203312c} - Mulberry32
 */
export class RNG {
  /**
   * The current state of the generator, updated with each number generation.
   * @private
   * @type {number}
   */
  #seed;

  /**
   * Creates an instance of the RNG.
   * @param {number | string | null | undefined} [seed] - The initial seed. If a string is provided,
   * it's hashed into a number. If null or undefined, a time-based seed is used.
   */
  constructor(seed) {
    this.setSeed(seed);
  }

  /**
   * Hashes a string into a 32-bit integer.
   * This is a simple, non-cryptographic hash function (cyrb53) suitable for
   * creating a numeric seed from a string.
   * @private
   * @param {string} str - The string to hash.
   * @returns {number} A 32-bit integer hash.
   */
  #hashString(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  /**
   * Resets the generator's state with a new seed.
   * @param {number | string | null | undefined} [seed] - The new seed to use.
   */
  setSeed(seed) {
    if (typeof seed === 'string' && seed.length > 0) {
      this.#seed = this.#hashString(seed);
    } else if (typeof seed === 'number' && Number.isFinite(seed)) {
      this.#seed = Math.floor(Math.abs(seed));
    } else {
      // Use a time-based seed for non-deterministic behavior if no valid seed is provided.
      this.#seed = Date.now();
    }
  }

  /**
   * Generates the next pseudo-random number in the sequence.
   * This is the core of the Mulberry32 algorithm.
   * @private
   * @returns {number} A 32-bit unsigned integer.
   */
  #next() {
    let t = (this.#seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  /**
   * Returns a pseudo-random floating-point number between 0 (inclusive) and 1 (exclusive).
   * This is equivalent to `Math.random()`.
   * @returns {number} A float between 0 and 1.
   */
  nextFloat() {
    return this.#next() / 4294967296; // 2^32
  }

  /**
   * Returns a pseudo-random integer between a minimum (inclusive) and a maximum (exclusive) value.
   * @param {number} min - The minimum integer value (inclusive).
   * @param {number} max - The maximum integer value (exclusive).
   * @returns {number} A random integer in the range [min, max).
   */
  nextInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('nextInt requires integer arguments for min and max.');
    }
    if (min >= max) {
      throw new Error('min must be less than max in nextInt.');
    }
    return Math.floor(this.nextFloat() * (max - min)) + min;
  }

  /**
   * Returns a pseudo-random integer between a minimum (inclusive) and a maximum (inclusive) value.
   * @param {number} min - The minimum integer value (inclusive).
   * @param {number} max - The maximum integer value (inclusive).
   * @returns {number} A random integer in the range [min, max].
   */
  nextIntInclusive(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('nextIntInclusive requires integer arguments for min and max.');
    }
    if (min > max) {
      throw new Error('min must be less than or equal to max in nextIntInclusive.');
    }
    return this.nextInt(min, max + 1);
  }

  /**
   * Returns a randomly selected element from an array.
   * Returns undefined if the array is empty.
   * @template T
   * @param {T[]} array - The array to choose from.
   * @returns {T | undefined} A random element from the array.
   */
  choice(array) {
    if (!Array.isArray(array) || array.length === 0) {
      return undefined;
    }
    const index = this.nextInt(0, array.length);
    return array[index];
  }

  /**
   * Shuffles an array in place using the Fisher-Yates (aka Knuth) shuffle algorithm.
   * The shuffle is deterministic based on the RNG's seed.
   * @template T
   * @param {T[]} array - The array to shuffle.
   * @returns {T[]} The same array, now shuffled.
   */
  shuffle(array) {
    if (!Array.isArray(array)) {
      throw new Error('shuffle requires an array argument.');
    }
    let currentIndex = array.length;
    let randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = this.nextInt(0, currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }
}