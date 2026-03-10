/**
 * @file test/scheduler.test.js
 * @description Integration tests for the Scheduler class.
 *
 * These tests verify the core functionality of the Scheduler, including job
 * lifecycle management, execution, persistence, and recovery from downtime.
 * It uses mocks for the storage layer (`src/state/storage.js`) and time
 * utilities (`src/utils/time.js`) to create a controlled test environment.
 */

import { test, describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';

// Modules to mock
import * as timeUtils from '../src/utils/time.js';
import * as storage from '../src/state/storage.js';

// Module to test
import { Scheduler, SchedulerError } from '../src/scheduler.js';
import { Job } from '../src/job.js';

// Use the mock.module API to intercept module loading.
mock.module('../src/utils/time.js', () => ({
  ...timeUtils, // Keep original exports
  setNow: mock.fn(timeUtils.setNow),
  resetNow: mock.fn(timeUtils.resetNow),
  now: mock.fn(timeUtils.now),
}));
mock.module('../src/state/storage.js', () => ({
  ...storage, // Keep original exports
  readState: mock.fn(),
  writeState: mock.fn(),
}));

const TEST_STORAGE_PATH = path.resolve('/tmp/scheduler-state.test.json');
const MINUTE_MS = 60 * 1000;

describe('Scheduler', () => {
  let fakeTime;
  let mockStorageState;

  // Helper to advance fake time
  const advanceTime = (ms) => {
    fakeTime += ms;
  };

  // Helper to create a simple async task mock
  const createAsyncTask = () => mock.fn(async () => {});

  beforeEach(() => {
    // Set a predictable start time for each test
    fakeTime = new Date('2023-01-01T10:00:00.000Z').getTime();
    timeUtils.setNow(() => fakeTime);

    // Reset storage state and mocks
    mockStorageState = { jobs: {} };
    storage.readState.mock.mockImplementation(async () => structuredClone(mockStorageState));
    storage.writeState.mock.mockImplementation(async (path, state) => {
      mockStorageState = structuredClone(state);
    });

    // Reset all mocks
    timeUtils.setNow.mock.reset();
    timeUtils.resetNow.mock.reset();
    timeUtils.now.mock.reset();
    storage.readState.mock.reset();
    storage.writeState.mock.reset();

    // Re-apply mocks for time and storage for the current test
    timeUtils.setNow(() => fakeTime);
    storage.readState.mock.mockImplementation(async () => structuredClone(mockStorageState));
    storage.writeState.mock.mockImplementation(async (path, state) => {
      mockStorageState = structuredClone(state);
    });
  });

  afterEach(() => {
    timeUtils.resetNow();
  });

  describe('Constructor and Initialization', () => {
    it('should throw SchedulerError if storagePath is missing', () => {
      assert.throws(() => new Scheduler({}), {
        name: 'SchedulerError',
        message: '`storagePath` is a required option.',
      });
    });

    it('should throw SchedulerError for an invalid tickInterval', () => {
      assert.throws(() => new Scheduler({ storagePath: TEST_STORAGE_PATH, tickInterval: 50 }), {
        name: 'SchedulerError',
        message: '`tickInterval` must be at least 100ms.',
      });
    });

    it('should throw SchedulerError for an invalid catchupPolicy', () => {
      assert.throws(() => new Scheduler({ storagePath: TEST_STORAGE_PATH, catchupPolicy: 'invalid' }), {
        name: 'SchedulerError',
        message: '`catchupPolicy` must be either "run" or "skip".',
      });
    });

    it('should correctly initialize with provided jobs', () => {
      const task1 = createAsyncTask();
      const jobs = [{ id: 'job-1', cronTime: '* * * * *', task: task1 }];
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs });
      const listedJobs = scheduler.listJobs();
      assert.strictEqual(listedJobs.length, 1);
      assert.strictEqual(listedJobs[0].id, 'job-1');
      assert.strictEqual(listedJobs[0].task, task1);
    });

    it('should throw TypeError if a job definition is missing a task function', () => {
      const jobs = [{ id: 'job-1', cronTime: '* * * * *' }]; // Missing task
      assert.throws(() => new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs }), {
        name: 'TypeError',
        message: 'Job definition with cronTime "* * * * *" is missing a \'task\' function.',
      });
    });
  });

  describe('start() and stop()', () => {
    it('should start, load state, and begin ticking', async () => {
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, tickInterval: 5000 });
      const startSpy = mock.fn();
      scheduler.on('start', startSpy);

      await scheduler.start();

      assert.strictEqual(startSpy.mock.callCount(), 1, 'start event should be emitted');
      assert.strictEqual(storage.readState.mock.callCount(), 1, 'should read state on start');
      // Tick is called once immediately on start
      assert.strictEqual(storage.writeState.mock.callCount(), 0, 'writeState not called if no jobs run');

      await scheduler.stop();
    });

    it('should stop, clear the timer, and persist final state', async () => {
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH });
      const stopSpy = mock.fn();
      scheduler.on('stop', stopSpy);

      await scheduler.start();
      await scheduler.stop();

      assert.strictEqual(stopSpy.mock.callCount(), 1, 'stop event should be emitted');
      assert.strictEqual(storage.writeState.mock.callCount(), 1, 'should write state on stop');
    });

    it('should warn if start() is called when already running', async () => {
      const warnSpy = mock.method(console, 'warn', () => {});
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH });
      await scheduler.start();
      await scheduler.start(); // Call start again

      assert.strictEqual(warnSpy.mock.callCount(), 1);
      assert.ok(warnSpy.mock.calls[0].arguments[0].includes('scheduler is already running'));

      await scheduler.stop();
    });

    it('should warn if stop() is called when not running', async () => {
        const warnSpy = mock.method(console, 'warn', () => {});
        const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH });
        await scheduler.stop(); // Call stop without starting

        assert.strictEqual(warnSpy.mock.callCount(), 1);
        assert.ok(warnSpy.mock.calls[0].arguments[0].includes('scheduler is not running'));
    });
  });

  describe('Job Execution and Scheduling', () => {
    it('should execute a due job on a tick', async () => {
      const task = createAsyncTask();
      const jobs = [{ id: 'job-1', cronTime: '* * * * *', task }]; // Every minute
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs, tickInterval: 1000 });

      await scheduler.start();

      // Initial nextRun is 10:01:00. Advance time past that.
      advanceTime(MINUTE_MS + 1000); // 10:01:01
      
      // Manually trigger tick logic (since setInterval is mocked by time)
      await scheduler._Scheduler__tick();

      assert.strictEqual(task.mock.callCount(), 1, 'Job task should have been executed once');
      
      const job = scheduler.listJobs()[0];
      const expectedNextRun = new Date('2023-01-01T10:02:00.000Z').getTime();
      assert.strictEqual(job.nextRun, expectedNextRun, 'Job nextRun should be updated to the next minute');
      assert.strictEqual(storage.writeState.mock.callCount(), 1, 'State should be persisted after job run');

      await scheduler.stop();
    });

    it('should not execute a job that is not due', async () => {
      const task = createAsyncTask();
      const jobs = [{ id: 'job-1', cronTime: '* * * * *', task }];
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs, tickInterval: 1000 });

      await scheduler.start();

      // Advance time, but not enough to make the job due
      advanceTime(10000); // 10:00:10

      await scheduler._Scheduler__tick();

      assert.strictEqual(task.mock.callCount(), 0, 'Job task should not have been executed');
      assert.strictEqual(storage.writeState.mock.callCount(), 0, 'State should not be persisted if no jobs run');

      await scheduler.stop();
    });

    it('should emit job:run, job:success on successful execution', async () => {
      const task = createAsyncTask();
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'j1', cronTime: '* * * * *', task }] });
      const runSpy = mock.fn();
      const successSpy = mock.fn();
      scheduler.on('job:run', runSpy);
      scheduler.on('job:success', successSpy);

      await scheduler.start();
      advanceTime(MINUTE_MS + 1);
      await scheduler._Scheduler__tick();

      assert.strictEqual(runSpy.mock.callCount(), 1);
      assert.strictEqual(successSpy.mock.callCount(), 1);
      assert.strictEqual(runSpy.mock.calls[0].arguments[0].id, 'j1');
      assert.strictEqual(successSpy.mock.calls[0].arguments[0].id, 'j1');

      await scheduler.stop();
    });

    it('should emit job:failure on failed execution and still reschedule', async () => {
      const error = new Error('Task Failed');
      const failingTask = mock.fn(async () => { throw error; });
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'j1', cronTime: '* * * * *', task: failingTask }] });
      const failureSpy = mock.fn();
      const successSpy = mock.fn();
      scheduler.on('job:failure', failureSpy);
      scheduler.on('job:success', successSpy);

      await scheduler.start();
      advanceTime(MINUTE_MS + 1);
      await scheduler._Scheduler__tick();

      assert.strictEqual(failingTask.mock.callCount(), 1);
      assert.strictEqual(successSpy.mock.callCount(), 0, 'job:success should not be emitted');
      assert.strictEqual(failureSpy.mock.callCount(), 1, 'job:failure should be emitted');
      assert.strictEqual(failureSpy.mock.calls[0].arguments[0], error);
      assert.strictEqual(failureSpy.mock.calls[0].arguments[1].id, 'j1');

      const job = scheduler.listJobs()[0];
      const expectedNextRun = new Date('2023-01-01T10:02:00.000Z').getTime();
      assert.strictEqual(job.nextRun, expectedNextRun, 'Job should be rescheduled even after failure');

      await scheduler.stop();
    });
  });

  describe('Persistence and Reconciliation', () => {
    it('should load persisted state on start', async () => {
      const persistedNextRun = new Date('2023-01-01T10:05:00.000Z').getTime();
      mockStorageState = {
        jobs: {
          'job-1': { id: 'job-1', cronTime: '* * * * *', nextRun: persistedNextRun }
        }
      };

      const task = createAsyncTask();
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'job-1', cronTime: '* * * * *', task }] });
      
      await scheduler.start();

      const job = scheduler.listJobs()[0];
      assert.strictEqual(job.nextRun, persistedNextRun, 'Job should be updated with persisted nextRun');

      await scheduler.stop();
    });

    it('should handle missed jobs with "skip" policy (default)', async () => {
      // Job was supposed to run at 10:00, but app was down and starts at 10:05
      const persistedNextRun = new Date('2023-01-01T10:00:00.000Z').getTime();
      mockStorageState = {
        jobs: {
          'job-1': { id: 'job-1', cronTime: '*/2 * * * *', nextRun: persistedNextRun } // Runs every 2 mins
        }
      };
      
      // Start time is 10:05
      fakeTime = new Date('2023-01-01T10:05:00.000Z').getTime();
      timeUtils.setNow(() => fakeTime);

      const task = createAsyncTask();
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'job-1', cronTime: '*/2 * * * *', task }], catchupPolicy: 'skip' });
      
      await scheduler.start(); // This calls loadAndReconcileState

      const job = scheduler.listJobs()[0];
      const expectedNextRun = new Date('2023-01-01T10:06:00.000Z').getTime();
      assert.strictEqual(job.nextRun, expectedNextRun, 'Should schedule the next run from NOW, skipping missed runs');

      // Tick at 10:05 should not run the job
      await scheduler._Scheduler__tick();
      assert.strictEqual(task.mock.callCount(), 0);

      await scheduler.stop();
    });

    it('should handle missed jobs with "run" policy', async () => {
      // Job was supposed to run at 10:02, but app was down and starts at 10:05
      const persistedNextRun = new Date('2023-01-01T10:02:00.000Z').getTime();
      mockStorageState = {
        jobs: {
          'job-1': { id: 'job-1', cronTime: '*/2 * * * *', nextRun: persistedNextRun }
        }
      };
      
      // Start time is 10:05
      fakeTime = new Date('2023-01-01T10:05:00.000Z').getTime();
      timeUtils.setNow(() => fakeTime);

      const task = createAsyncTask();
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'job-1', cronTime: '*/2 * * * *', task }], catchupPolicy: 'run' });
      
      await scheduler.start();

      // On start, the old nextRun should be preserved so it runs immediately
      const job = scheduler.listJobs()[0];
      assert.strictEqual(job.nextRun, persistedNextRun);
      
      // The first tick at 10:05 should execute the missed job
      await scheduler._Scheduler__tick();
      assert.strictEqual(task.mock.callCount(), 1, 'Should run the missed job at 10:02');
      
      // After running, it should schedule the next one from the *last* run time (10:02 -> 10:04)
      const expectedNextRunAfterFirst = new Date('2023-01-01T10:04:00.000Z').getTime();
      assert.strictEqual(job.nextRun, expectedNextRunAfterFirst, 'Should schedule next run from last scheduled time');

      // The next tick (still at 10:05) should run the job for 10:04
      await scheduler._Scheduler__tick();
      assert.strictEqual(task.mock.callCount(), 2, 'Should run the missed job at 10:04');
      
      // After running again, it should schedule the next one (10:04 -> 10:06)
      const expectedNextRunAfterSecond = new Date('2023-01-01T10:06:00.000Z').getTime();
      assert.strictEqual(job.nextRun, expectedNextRunAfterSecond, 'Should now be scheduled for a future time');
      
      // A third tick should not run anything
      await scheduler._Scheduler__tick();
      assert.strictEqual(task.mock.callCount(), 2);

      await scheduler.stop();
    });
  });

  describe('Dynamic Job Management', () => {
    it('should dynamically add a job', async () => {
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH });
      await scheduler.start();
      
      const task = createAsyncTask();
      const addSpy = mock.fn();
      scheduler.on('job:add', addSpy);

      const newJob = await scheduler.addJob({ id: 'dynamic-job', cronTime: '* * * * *', task });

      assert.ok(newJob instanceof Job);
      assert.strictEqual(scheduler.listJobs().length, 1);
      assert.strictEqual(scheduler.listJobs()[0].id, 'dynamic-job');
      assert.strictEqual(addSpy.mock.callCount(), 1);
      assert.strictEqual(addSpy.mock.calls[0].arguments[0].id, 'dynamic-job');
      assert.strictEqual(storage.writeState.mock.callCount(), 1, 'State should be persisted after adding a job');
      assert.ok(mockStorageState.jobs['dynamic-job']);

      await scheduler.stop();
    });

    it('should throw when adding a job with a duplicate ID', async () => {
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'job-1', cronTime: '* * * * *', task: async () => {} }] });
      await scheduler.start();

      await assert.rejects(
        scheduler.addJob({ id: 'job-1', cronTime: '0 0 * * *', task: async () => {} }),
        { name: 'SchedulerError', message: 'A job with ID "job-1" already exists.' }
      );

      await scheduler.stop();
    });

    it('should dynamically remove a job', async () => {
      const task = createAsyncTask();
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH, jobs: [{ id: 'job-1', cronTime: '* * * * *', task }] });
      await scheduler.start();

      const removeSpy = mock.fn();
      scheduler.on('job:remove', removeSpy);

      assert.strictEqual(scheduler.listJobs().length, 1);

      const result = await scheduler.removeJob('job-1');

      assert.strictEqual(result, true);
      assert.strictEqual(scheduler.listJobs().length, 0);
      assert.strictEqual(removeSpy.mock.callCount(), 1);
      assert.strictEqual(removeSpy.mock.calls[0].arguments[0].id, 'job-1');
      assert.strictEqual(storage.writeState.mock.callCount(), 1, 'State should be persisted after removing a job');
      assert.deepStrictEqual(mockStorageState.jobs, {});

      await scheduler.stop();
    });

    it('should return false when trying to remove a non-existent job', async () => {
      const scheduler = new Scheduler({ storagePath: TEST_STORAGE_PATH });
      await scheduler.start();

      const result = await scheduler.removeJob('non-existent-job');
      assert.strictEqual(result, false);
      assert.strictEqual(storage.writeState.mock.callCount(), 0, 'State should not be persisted if no job was removed');

      await scheduler.stop();
    });
  });
});