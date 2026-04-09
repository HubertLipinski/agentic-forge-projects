import { test, describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Sentinel } from '../src/sentinel.js';

// A utility to wait for a specific amount of time.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Sentinel', () => {
  let originalMemoryUsage;

  // Mock `process.memoryUsage` to control heap values in tests.
  beforeEach(() => {
    originalMemoryUsage = process.memoryUsage;
    mock.method(process, 'memoryUsage', () => ({
      rss: 100 * 1024 * 1024,
      heapTotal: 70 * 1024 * 1024,
      heapUsed: 50 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 1 * 1024 * 1024,
    }));
  });

  afterEach(() => {
    mock.reset();
    process.memoryUsage = originalMemoryUsage;
  });

  describe('Constructor and Options', () => {
    it('should instantiate with default options', () => {
      const sentinel = new Sentinel();
      assert.strictEqual(sentinel instanceof EventEmitter, true, 'should extend EventEmitter');
      assert.strictEqual(sentinel.isRunning(), false, 'should not be running by default');
    });

    it('should accept and apply valid custom options', () => {
      const onLeak = () => {};
      const sentinel = new Sentinel({
        sampleInterval: 2000,
        alertThreshold: 5,
        onLeak,
      });

      // Accessing private fields for testing purposes.
      assert.strictEqual(sentinel['#options'].sampleInterval, 2000);
      assert.strictEqual(sentinel['#options'].alertThreshold, 5);
      assert.strictEqual(sentinel.listenerCount('leak'), 1, 'onLeak callback should be registered');
    });

    it('should start automatically when autoStart is true', () => {
      const sentinel = new Sentinel({ autoStart: true });
      assert.strictEqual(sentinel.isRunning(), true, 'should be running if autoStart is true');
      sentinel.stop();
    });

    it('should throw an error for invalid sampleInterval', () => {
      assert.throws(() => new Sentinel({ sampleInterval: 999 }), {
        message: 'Sentinel option "sampleInterval" must be a number >= 1000.',
      });
      assert.throws(() => new Sentinel({ sampleInterval: '2000' }), {
        message: 'Sentinel option "sampleInterval" must be a number >= 1000.',
      });
    });

    it('should throw an error for invalid alertThreshold', () => {
      assert.throws(() => new Sentinel({ alertThreshold: 1 }), {
        message: 'Sentinel option "alertThreshold" must be a number >= 2.',
      });
      assert.throws(() => new Sentinel({ alertThreshold: '3' }), {
        message: 'Sentinel option "alertThreshold" must be a number >= 2.',
      });
    });

    it('should throw an error for invalid onLeak callback', () => {
      assert.throws(() => new Sentinel({ onLeak: 'not-a-function' }), {
        message: 'Sentinel option "onLeak" must be a function.',
      });
    });

    it('should throw an error for invalid autoStart option', () => {
      assert.throws(() => new Sentinel({ autoStart: 'true' }), {
        message: 'Sentinel option "autoStart" must be a boolean.',
      });
    });
  });

  describe('Lifecycle: start(), stop(), isRunning()', () => {
    it('should correctly report running state', () => {
      const sentinel = new Sentinel();
      assert.strictEqual(sentinel.isRunning(), false, 'should not be running initially');
      sentinel.start();
      assert.strictEqual(sentinel.isRunning(), true, 'should be running after start()');
      sentinel.stop();
      assert.strictEqual(sentinel.isRunning(), false, 'should not be running after stop()');
    });

    it('should emit "start" and "stop" events', (t, done) => {
      const sentinel = new Sentinel();
      let startEmitted = false;
      let stopEmitted = false;

      sentinel.on('start', () => {
        startEmitted = true;
      });
      sentinel.on('stop', () => {
        stopEmitted = true;
        assert.ok(startEmitted, 'start event should have been emitted');
        assert.ok(stopEmitted, 'stop event should have been emitted');
        done();
      });

      sentinel.start();
      sentinel.stop();
    });

    it('should not start if already running', () => {
      const sentinel = new Sentinel();
      sentinel.start();
      const intervalId = sentinel['#intervalId'];
      sentinel.start(); // Second call
      assert.strictEqual(sentinel['#intervalId'], intervalId, 'interval ID should not change');
      sentinel.stop();
    });

    it('should not stop if not running', () => {
      const sentinel = new Sentinel();
      const emitSpy = mock.fn();
      sentinel.on('stop', emitSpy);
      sentinel.stop();
      assert.strictEqual(emitSpy.mock.callCount(), 0, 'stop event should not be emitted');
    });

    it('should reset state on start() and stop()', () => {
      const sentinel = new Sentinel();
      // Manually set state to simulate a running monitor
      sentinel['#heapReadings'] = [1, 2, 3];
      sentinel['#consecutiveIncreases'] = 2;
      sentinel['#lastAlertedHeapSize'] = 100;

      sentinel.stop(); // Stop should reset it

      assert.deepStrictEqual(sentinel['#heapReadings'], [], 'heapReadings should be empty after stop');
      assert.strictEqual(sentinel['#consecutiveIncreases'], 0, 'consecutiveIncreases should be 0 after stop');
      assert.strictEqual(sentinel['#lastAlertedHeapSize'], 0, 'lastAlertedHeapSize should be 0 after stop');

      // Set state again
      sentinel['#heapReadings'] = [1, 2, 3];
      sentinel['#consecutiveIncreases'] = 2;
      sentinel['#lastAlertedHeapSize'] = 100;

      sentinel.start(); // Start should also reset it

      assert.deepStrictEqual(sentinel['#heapReadings'], [], 'heapReadings should be empty after start');
      assert.strictEqual(sentinel['#consecutiveIncreases'], 0, 'consecutiveIncreases should be 0 after start');
      assert.strictEqual(sentinel['#lastAlertedHeapSize'], 0, 'lastAlertedHeapSize should be 0 after start');

      sentinel.stop();
    });
  });

  describe('Leak Detection Logic', () => {
    it('should trigger a leak event after consecutive increases meet the threshold', async () => {
      const sentinel = new Sentinel({ sampleInterval: 10, alertThreshold: 3 });
      let leakDetected = false;
      let leakDetails = null;

      sentinel.on('leak', (details) => {
        leakDetected = true;
        leakDetails = details;
        sentinel.stop();
      });

      sentinel.start();

      // Simulate heap growth
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15); // Sample 1: 100
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 200 }));
      await sleep(15); // Sample 2: 200 (1 increase)
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      await sleep(15); // Sample 3: 300 (2 increases) -> Alert!

      assert.ok(leakDetected, 'Leak event should have been triggered');
      assert.strictEqual(leakDetails.heapUsed, 300);
      assert.deepStrictEqual(leakDetails.history, [100, 200, 300]);
      assert.strictEqual(leakDetails.alertThreshold, 3);
      assert.ok(leakDetails.message.includes('3 samples'));
    });

    it('should not trigger a leak event if memory fluctuates', async () => {
      const sentinel = new Sentinel({ sampleInterval: 10, alertThreshold: 4 });
      const leakSpy = mock.fn();
      sentinel.on('leak', leakSpy);

      sentinel.start();

      // Simulate heap fluctuation
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15); // Sample 1: 100
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 200 }));
      await sleep(15); // Sample 2: 200 (1 increase)
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 150 })); // Fluctuation, counter resets
      await sleep(15); // Sample 3: 150 (0 increases)
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 250 }));
      await sleep(15); // Sample 4: 250 (1 increase)

      sentinel.stop();
      assert.strictEqual(leakSpy.mock.callCount(), 0, 'Leak event should not be triggered');
    });

    it('should not trigger a leak event if memory is stable', async () => {
      const sentinel = new Sentinel({ sampleInterval: 10, alertThreshold: 3 });
      const leakSpy = mock.fn();
      sentinel.on('leak', leakSpy);

      sentinel.start();

      // Simulate stable heap
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15);

      sentinel.stop();
      assert.strictEqual(leakSpy.mock.callCount(), 0, 'Leak event should not be triggered for stable memory');
    });

    it('should maintain a sliding window of readings', () => {
      const sentinel = new Sentinel({ alertThreshold: 3 });
      const sample = sentinel['#sampleHeap'].bind(sentinel);

      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      sample();
      assert.deepStrictEqual(sentinel['#heapReadings'], [100]);

      mock.method(process, 'memoryUsage', () => ({ heapUsed: 200 }));
      sample();
      assert.deepStrictEqual(sentinel['#heapReadings'], [100, 200]);

      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      sample();
      assert.deepStrictEqual(sentinel['#heapReadings'], [100, 200, 300]);

      mock.method(process, 'memoryUsage', () => ({ heapUsed: 400 }));
      sample(); // Window is full, should slide
      assert.deepStrictEqual(sentinel['#heapReadings'], [200, 300, 400]);
    });

    it('should not re-alert for the same memory plateau', async () => {
      const sentinel = new Sentinel({ sampleInterval: 10, alertThreshold: 3 });
      const leakSpy = mock.fn();
      sentinel.on('leak', leakSpy);

      sentinel.start();

      // First leak
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 200 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      await sleep(15); // Alert 1 at 300

      assert.strictEqual(leakSpy.mock.callCount(), 1, 'Should have alerted once');
      assert.strictEqual(sentinel['#lastAlertedHeapSize'], 300);

      // Memory stays at the same plateau, but still "increasing" from the window's perspective
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      await sleep(15);

      assert.strictEqual(leakSpy.mock.callCount(), 1, 'Should not re-alert for the same plateau');

      // Now increase again
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 400 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 500 }));
      await sleep(15); // Alert 2 at 500

      assert.strictEqual(leakSpy.mock.callCount(), 2, 'Should alert again after a new significant increase');
      assert.strictEqual(sentinel['#lastAlertedHeapSize'], 500);

      sentinel.stop();
    });

    it('should use the onLeak callback if provided', async () => {
      const onLeakSpy = mock.fn();
      const sentinel = new Sentinel({
        sampleInterval: 10,
        alertThreshold: 3,
        onLeak: onLeakSpy,
      });

      sentinel.start();

      mock.method(process, 'memoryUsage', () => ({ heapUsed: 100 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 200 }));
      await sleep(15);
      mock.method(process, 'memoryUsage', () => ({ heapUsed: 300 }));
      await sleep(15);

      sentinel.stop();

      assert.strictEqual(onLeakSpy.mock.callCount(), 1, 'onLeak callback should have been called');
      const details = onLeakSpy.mock.calls[0].arguments[0];
      assert.strictEqual(details.heapUsed, 300);
    });
  });
});