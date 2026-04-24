/**
 * src/stream-handler.js
 *
 * This module is responsible for managing the logical replication stream once
 * the connection is established. It handles the low-level `CopyData` messages,
 * orchestrates the parsing of `pgoutput` data, and manages the feedback loop
 * with the PostgreSQL server.
 *
 * Key responsibilities include:
 * - Listening for `CopyData` messages on the active `pg.Client` stream.
 * - Distinguishing between WAL data (`XLogData`) and keep-alive messages.
 * - Sending periodic keep-alive messages to prevent connection timeouts.
 * - Acknowledging processed WAL positions (LSNs) back to the server to allow
 *   PostgreSQL to reclaim disk space (a process known as "flushing").
 * - Providing a mechanism for graceful shutdown, ensuring the final LSN is
 *   acknowledged before disconnection.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { WAL_MESSAGE_CODES, PG_BACKEND_MESSAGE_CODES } from './constants.js';

/**
 * Represents a Log Sequence Number (LSN) in PostgreSQL.
 * Provides utility methods for comparison and manipulation.
 * LSNs are 64-bit integers, represented as strings in the format 'X/Y'.
 */
class LSN {
  /**
   * @param {string | bigint} lsnValue - The LSN value as a string ('X/Y') or a BigInt.
   */
  constructor(lsnValue) {
    if (typeof lsnValue === 'string') {
      if (!/^[0-9A-F]+\/[0-9A-F]+$/.test(lsnValue)) {
        throw new Error(`Invalid LSN string format: ${lsnValue}`);
      }
      const [upper, lower] = lsnValue.split('/').map(hex => BigInt(`0x${hex}`));
      this.value = (upper << 32n) + lower;
    } else if (typeof lsnValue === 'bigint') {
      this.value = lsnValue;
    } else {
      throw new Error('LSN must be initialized with a string or a BigInt.');
    }
  }

  /**
   * Converts the LSN back to the 'X/Y' string format.
   * @returns {string}
   */
  toString() {
    const upper = this.value >> 32n;
    const lower = this.value & 0xFFFFFFFFn;
    return `${upper.toString(16).toUpperCase()}/${lower.toString(16).toUpperCase()}`;
  }

  /**
   * Compares this LSN with another.
   * @param {LSN} otherLsn - The LSN to compare against.
   * @returns {number} -1 if this LSN is smaller, 0 if equal, 1 if larger.
   */
  compare(otherLsn) {
    if (this.value < otherLsn.value) return -1;
    if (this.value > otherLsn.value) return 1;
    return 0;
  }
}

/**
 * Manages the replication stream, handling keep-alives and LSN feedback.
 */
export class StreamHandler {
  /**
   * @private
   * @type {import('pg').Client}
   */
  #client;

  /**
   * @private
   * @type {(buffer: Buffer) => void}
   * Callback function to process parsed pgoutput messages.
   */
  #onData;

  /**
   * @private
   * @type {object}
   */
  #options;

  /**
   * @private
   * @type {LSN}
   * The last LSN received from the server.
   */
  #lastLsn;

  /**
   * @private
   * @type {LSN}
   * The last LSN that was flushed (acknowledged) to the server.
   */
  #lastFlushedLsn;

  /**
   * @private
   * @type {NodeJS.Timeout | null}
   */
  #keepAliveTimer = null;

  /**
   * @private
   * @type {NodeJS.Timeout | null}
   */
  #flushTimer = null;

  /**
   * @private
   * @type {boolean}
   */
  #isStopped = false;

  /**
   * Constructs a StreamHandler.
   * @param {import('pg').Client} client - The active pg.Client in replication mode.
   * @param {(buffer: Buffer) => void} onData - Callback to handle incoming pgoutput data buffers.
   * @param {object} options
   * @param {string} options.startLsn - The initial LSN for the stream.
   * @param {number} options.keepAliveIntervalMs - Interval for sending keep-alives.
   * @param {number} options.flushIntervalMs - Interval for flushing LSN.
   */
  constructor(client, onData, options) {
    this.#client = client;
    this.#onData = onData;
    this.#options = options;

    this.#lastLsn = new LSN(options.startLsn);
    this.#lastFlushedLsn = new LSN(options.startLsn);

    this.#attachListeners();
  }

  /**
   * Starts the keep-alive and flush timers.
   */
  start() {
    this.#isStopped = false;
    this.#scheduleKeepAlive();
    this.#scheduleFlush();
  }

  /**
   * Stops all timers and performs a final LSN flush.
   * @param {boolean} [finalFlush=true] - Whether to perform a final flush.
   * @returns {Promise<void>}
   */
  async stop(finalFlush = true) {
    if (this.#isStopped) return;
    this.#isStopped = true;

    this.#clearTimers();

    if (finalFlush) {
      await this.#flushLsn();
    }
  }

  /**
   * @private
   * Attaches listeners to the pg.Client stream for handling replication messages.
   */
  #attachListeners() {
    this.#client.on('message', (msg) => {
      // In replication mode, all logical replication data arrives as 'CopyData' messages.
      if (msg.name === PG_BACKEND_MESSAGE_CODES.CopyData) {
        this.#handleCopyData(msg.chunk);
      }
    });
  }

  /**
   * @private
   * Processes a CopyData message from the server.
   * @param {Buffer} buffer - The raw buffer from the CopyData message.
   */
  #handleCopyData(buffer) {
    const messageType = String.fromCharCode(buffer.readUInt8(0));
    const payload = buffer.subarray(1);

    switch (messageType) {
      case WAL_MESSAGE_CODES.XLogData:
        this.#handleXLogData(payload);
        break;

      case WAL_MESSAGE_CODES.PrimaryKeepAlive:
        this.#handlePrimaryKeepAlive(payload);
        break;

      default:
        // This should not happen in a normal replication stream.
        console.warn(`Unknown CopyData message type: "${messageType}"`);
        break;
    }
  }

  /**
   * @private
   * Handles an XLogData message, which contains the actual database changes.
   * @param {Buffer} payload - The XLogData payload.
   */
  #handleXLogData(payload) {
    let offset = 0;
    // The LSN of the WAL data chunk.
    const walStart = payload.readBigUInt64BE(offset);
    offset += 8;
    // The server's current LSN.
    const serverWalEnd = payload.readBigUInt64BE(offset);
    offset += 8;
    // The server's clock time at the time of transmission.
    const serverTime = payload.readBigUInt64BE(offset);
    offset += 8;

    const newLsn = new LSN(walStart);
    if (newLsn.compare(this.#lastLsn) > 0) {
      this.#lastLsn = newLsn;
    }

    const logicalMsg = payload.subarray(offset);
    this.#onData(logicalMsg);
  }

  /**
   * @private
   * Handles a PrimaryKeepAlive message from the server.
   * @param {Buffer} payload - The PrimaryKeepAlive payload.
   */
  #handlePrimaryKeepAlive(payload) {
    let offset = 0;
    // The server's current LSN.
    const serverWalEnd = payload.readBigUInt64BE(offset);
    offset += 8;
    // The server's clock time.
    const serverTime = payload.readBigUInt64BE(offset);
    offset += 8;
    // If 1, a reply is requested.
    const replyRequested = payload.readUInt8(offset) === 1;

    const serverLsn = new LSN(serverWalEnd);
    if (serverLsn.compare(this.#lastLsn) > 0) {
      this.#lastLsn = serverLsn;
    }

    if (replyRequested) {
      this.#flushLsn().catch(err => {
        console.error('Failed to send requested keep-alive reply:', err);
      });
    }
  }

  /**
   * @private
   * Sends a Standby Status Update message to the server, acknowledging the
   * processed LSN. This is the "feedback" mechanism.
   * @returns {Promise<void>}
   */
  async #flushLsn() {
    if (this.#lastLsn.compare(this.#lastFlushedLsn) <= 0) {
      // No new LSN to report, no need to flush.
      return;
    }

    const now = BigInt(Date.now() - 946684800000) * 1000n; // PG epoch
    const receivedLsn = this.#lastLsn.value;
    const flushedLsn = this.#lastLsn.value;
    const appliedLsn = this.#lastLsn.value;

    const response = Buffer.alloc(34);
    response.write('r', 0); // Standby status update message type
    response.writeBigUInt64BE(receivedLsn, 1);
    response.writeBigUInt64BE(flushedLsn, 9);
    response.writeBigUInt64BE(appliedLsn, 17);
    response.writeBigInt64BE(now, 25);
    response.writeUInt8(0, 33); // No reply requested

    try {
      // `copyData` is the method to send data back to the server during COPY BOTH.
      await this.#client.copyData(response);
      this.#lastFlushedLsn = new LSN(flushedLsn);
    } catch (error) {
      console.error('Failed to flush LSN:', error.message);
      // The connection might be broken, the main client loop should handle this.
    }
  }

  /**
   * @private
   * Schedules the periodic LSN flush.
   */
  #scheduleFlush() {
    if (this.#isStopped || this.#options.flushIntervalMs <= 0) return;

    this.#flushTimer = setTimeout(async () => {
      try {
        await this.#flushLsn();
      } catch (err) {
        console.error('Error during scheduled LSN flush:', err);
      } finally {
        if (!this.#isStopped) {
          this.#scheduleFlush();
        }
      }
    }, this.#options.flushIntervalMs);
  }

  /**
   * @private
   * Schedules the periodic client-side keep-alive. This is just a flush,
   * which serves as a keep-alive from the client's perspective.
   */
  #scheduleKeepAlive() {
    if (this.#isStopped || this.#options.keepAliveIntervalMs <= 0) return;

    this.#keepAliveTimer = setTimeout(async () => {
      try {
        // Sending a status update (flush) also acts as a keep-alive.
        await this.#flushLsn();
      } catch (err) {
        console.error('Error during scheduled keep-alive:', err);
      } finally {
        if (!this.#isStopped) {
          this.#scheduleKeepAlive();
        }
      }
    }, this.#options.keepAliveIntervalMs);
  }

  /**
   * @private
   * Clears all active timers.
   */
  #clearTimers() {
    if (this.#keepAliveTimer) {
      clearTimeout(this.#keepAliveTimer);
      this.#keepAliveTimer = null;
    }
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
  }
}