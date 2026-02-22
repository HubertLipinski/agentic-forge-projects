/**
 * @file src/utils/constants.js
 * @description Exports constant values for the stream-fork-join project.
 *
 * This file centralizes constants, particularly internal event names, to prevent
 * magic strings and ensure consistency across different components of the library.
 * Using constants for event names helps avoid typos and makes the code easier to
 * refactor and maintain.
 */

/**
 * @constant {object} FORK_EVENTS
 * @description Events used internally by the ForkMultiplexer and its associated streams.
 * These events facilitate communication about the state of individual forked streams,
 * such as completion, errors, and backpressure signals.
 */
export const FORK_EVENTS = {
  /**
   * Emitted by a fork target when it finishes processing all data.
   * This signals to the JoinAggregator that one branch of the fork has completed.
   * The event handler receives the unique ID of the fork and any data it wishes to pass to the join stream.
   * @event FORK_EVENTS#FORK_FINISHED
   * @type {string}
   */
  FORK_FINISHED: 'fork:finished',

  /**
   * Emitted by a fork target when it encounters an error.
   * This allows the main multiplexer to decide on an error handling strategy,
   * such as destroying all other forks or allowing them to continue.
   * @event FORK_EVENTS#FORK_ERROR
   * @type {string}
   */
  FORK_ERROR: 'fork:error',
};

/**
 * @constant {object} JOIN_EVENTS
 * @description Events used internally by the JoinAggregator.
 * These are primarily for signaling the overall completion of the join phase.
 */
export const JOIN_EVENTS = {
  /**
   * Emitted by the JoinAggregator after all forks have finished and all their
   * resulting data has been pushed to the downstream readable stream.
   * This signifies the end of the entire fork-join operation.
   * @event JOIN_EVENTS#ALL_FORKS_JOINED
   * @type {string}
   */
  ALL_FORKS_JOINED: 'join:all_forks_joined',
};

/**
 * @constant {object} DEFAULT_OPTIONS
 * @description Default configuration options for the fork and join functions.
 * This provides sensible defaults that can be overridden by the user.
 */
export const DEFAULT_OPTIONS = {
  /**
   * The default highWaterMark for internal streams, in bytes for buffer mode
   * or number of objects for object mode. This controls the size of the
   * internal buffer and is a key part of managing backpressure.
   * @type {number}
   */
  highWaterMark: 16 * 1024, // 16kb, Node's default for streams

  /**
   * The default error handling strategy. If `true`, an error in any single
   * forked stream will cause all other forks to be destroyed, halting the
   * entire pipeline. If `false`, other forks will be allowed to complete.
   * @type {boolean}
   */
  abortOnError: true,

  /**
   * The default setting for whether the join stream should be in object mode.
   * This is typically determined by the source stream's mode.
   * @type {boolean}
   */
  objectMode: false,
};