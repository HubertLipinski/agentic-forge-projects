import { EventEmitter } from 'node:events';

/**
 * @typedef {object} SentinelOptions
 * @property {number} [sampleInterval=5000] - The interval in milliseconds to sample heap usage. Must be at least 1000.
 * @property {number} [alertThreshold=3] - The number of consecutive heap size increases required to trigger an alert. Must be at least 2.
 * @property {function(object): void} [onLeak] - A callback function to be executed when a potential leak is detected.
 * @property {boolean} [autoStart=false] - Whether to start monitoring immediately upon instantiation.
 */

/**
 * A simple, embeddable memory leak detector for long-running Node.js applications.
 * It periodically samples heap usage and triggers alerts if the memory grows
 * consistently over several intervals.
 *
 * @extends {EventEmitter}
 */
export class Sentinel extends EventEmitter {
  /**
   * The configuration options for the Sentinel instance.
   * @private
   * @type {Required<SentinelOptions>}
   */
  #options;

  /**
   * The timer ID for the periodic sampling interval.
   * @private
   * @type {?NodeJS.Timeout}
   */
  #intervalId = null;

  /**
   * A sliding window of recent heap usage readings in bytes.
   * The size of the window is determined by the `alertThreshold`.
   * @private
   * @type {number[]}
   */
  #heapReadings = [];

  /**
   * The number of consecutive heap size increases observed.
   * @private
   * @type {number}
   */
  #consecutiveIncreases = 0;

  /**
   * The last reported heap size that triggered an alert, to avoid repeated alerts for the same plateau.
   * @private
   * @type {number}
   */
  #lastAlertedHeapSize = 0;

  /**
   * Creates an instance of Sentinel.
   * @param {SentinelOptions} [options={}] - Configuration options for the Sentinel.
   */
  constructor(options = {}) {
    super();
    this.#validateOptions(options);

    this.#options = {
      sampleInterval: options.sampleInterval ?? 5000,
      alertThreshold: options.alertThreshold ?? 3,
      onLeak: options.onLeak ?? null,
      autoStart: options.autoStart ?? false,
    };

    if (this.#options.onLeak) {
      this.on('leak', this.#options.onLeak);
    }

    if (this.#options.autoStart) {
      this.start();
    }
  }

  /**
   * Validates the constructor options.
   * @private
   * @param {SentinelOptions} options - The options to validate.
   * @throws {Error} If any option is invalid.
   */
  #validateOptions(options) {
    if (options.sampleInterval !== undefined && (typeof options.sampleInterval !== 'number' || options.sampleInterval < 1000)) {
      throw new Error('Sentinel option "sampleInterval" must be a number >= 1000.');
    }
    if (options.alertThreshold !== undefined && (typeof options.alertThreshold !== 'number' || options.alertThreshold < 2)) {
      throw new Error('Sentinel option "alertThreshold" must be a number >= 2.');
    }
    if (options.onLeak !== undefined && typeof options.onLeak !== 'function') {
      throw new Error('Sentinel option "onLeak" must be a function.');
    }
    if (options.autoStart !== undefined && typeof options.autoStart !== 'boolean') {
      throw new Error('Sentinel option "autoStart" must be a boolean.');
    }
  }

  /**
   * Starts the memory monitoring process.
   * Does nothing if the monitor is already running.
   */
  start() {
    if (this.isRunning()) {
      return;
    }

    // Reset state in case of a restart
    this.#resetState();

    this.#intervalId = setInterval(() => {
      this.#sampleHeap();
    }, this.#options.sampleInterval);

    // Prevent the interval from keeping the Node.js process alive if it's the only thing running.
    this.#intervalId.unref();
    this.emit('start');
  }

  /**
   * Stops the memory monitoring process.
   * Does nothing if the monitor is not running.
   */
  stop() {
    if (!this.isRunning()) {
      return;
    }

    clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#resetState();
    this.emit('stop');
  }

  /**
   * Checks if the Sentinel is currently monitoring memory usage.
   * @returns {boolean} `true` if monitoring is active, `false` otherwise.
   */
  isRunning() {
    return this.#intervalId !== null;
  }

  /**
   * Resets the internal state of the Sentinel.
   * @private
   */
  #resetState() {
    this.#heapReadings = [];
    this.#consecutiveIncreases = 0;
    this.#lastAlertedHeapSize = 0;
  }

  /**
   * Samples the current heap usage and analyzes it for potential leaks.
   * This is the core logic executed at each interval.
   * @private
   */
  #sampleHeap() {
    const currentHeapUsed = process.memoryUsage().heapUsed;
    const previousHeapUsed = this.#heapReadings.at(-1) ?? 0;

    this.#heapReadings.push(currentHeapUsed);

    // Maintain the sliding window size
    if (this.#heapReadings.length > this.#options.alertThreshold) {
      this.#heapReadings.shift();
    }

    if (currentHeapUsed > previousHeapUsed && previousHeapUsed > 0) {
      this.#consecutiveIncreases++;
    } else {
      // Reset counter if memory usage does not increase
      this.#consecutiveIncreases = 0;
    }

    this.#checkForLeak(currentHeapUsed);
  }

  /**
   * Checks if the collected data indicates a memory leak and triggers an alert if necessary.
   * @private
   * @param {number} currentHeapUsed - The current heap usage in bytes.
   */
  #checkForLeak(currentHeapUsed) {
    // A leak is suspected if we have a full window of readings and all of them are increasing.
    // The number of increases will be `alertThreshold - 1`.
    const isLeakSuspected = this.#heapReadings.length === this.#options.alertThreshold &&
                            this.#consecutiveIncreases >= this.#options.alertThreshold - 1;

    if (isLeakSuspected) {
      // To prevent spamming alerts for the same memory plateau, we only alert
      // if the current heap size is significantly larger than the last one we alerted for.
      // A simple check is to see if it's larger at all.
      if (currentHeapUsed > this.#lastAlertedHeapSize) {
        this.#triggerAlert(currentHeapUsed);
        this.#lastAlertedHeapSize = currentHeapUsed;
      }
      // Reset after alerting to start a new detection cycle.
      this.#consecutiveIncreases = 0;
    }
  }

  /**
   * Emits a 'leak' event with details about the potential memory leak.
   * @private
   * @param {number} currentHeapUsed - The current heap usage in bytes.
   */
  #triggerAlert(currentHeapUsed) {
    const leakDetails = {
      message: `Potential memory leak detected. Heap has consistently increased over the last ${this.#options.alertThreshold} samples.`,
      heapUsed: currentHeapUsed,
      history: [...this.#heapReadings],
      consecutiveIncreases: this.#consecutiveIncreases + 1, // +1 to be more intuitive for user (N samples means N-1 increases)
      sampleInterval: this.#options.sampleInterval,
      alertThreshold: this.#options.alertThreshold,
      timestamp: new Date().toISOString(),
    };

    this.emit('leak', leakDetails);
  }
}