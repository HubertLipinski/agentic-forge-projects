/**
 * @file src/net/telnet-client.js
 * @description Represents a single connected player, handling I/O and screen buffering.
 *
 * This class is a crucial bridge between a raw TCP socket and the game engine.
 * It encapsulates the logic for Telnet protocol negotiation, parsing user input
 * (including special keys like arrows), and managing a double-buffered screen
 * to provide flicker-free updates to the player's terminal.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// Telnet Command Constants (as per RFC 854)
const TELNET = {
    IAC: 255,  // Interpret as Command
    WILL: 251, // Will perform
    WONT: 252, // Won't perform
    DO: 253,   // Please perform
    DONT: 254, // Please don't perform
    // Telnet Options
    ECHO: 1,           // Echo
    SUPPRESS_GO_AHEAD: 3, // Suppress Go-Ahead
    NAWS: 31,          // Negotiate About Window Size
};

// ANSI/VT100 Escape Sequences for terminal control
const ANSI = {
    CLEAR_SCREEN: '\x1B[2J',
    CURSOR_HOME: '\x1B[H',
    HIDE_CURSOR: '\x1B[?25l',
    SHOW_CURSOR: '\x1B[?25h',
};

/**
 * A simple screen buffer for terminal rendering.
 * It uses a double-buffering technique to minimize flicker and reduce bandwidth.
 * Only the changed parts of the screen are sent to the client on each render.
 */
class ScreenBuffer {
    /** @type {number} */
    width;
    /** @type {number} */
    height;
    /** @type {string[][]} */
    #currentBuffer;
    /** @type {string[][]} */
    #previousBuffer;

    /**
     * @param {object} options
     * @param {number} options.width - The width of the terminal screen.
     * @param {number} options.height - The height of the terminal screen.
     */
    constructor({ width = 80, height = 24 } = {}) {
        this.resize(width, height);
    }

    /**
     * Clears the current screen buffer, preparing it for a new frame.
     */
    clear() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.#currentBuffer[y][x] = ' ';
            }
        }
    }

    /**
     * Draws a string at a specific coordinate in the buffer.
     * @param {number} x - The x-coordinate (column).
     * @param {number} y - The y-coordinate (row).
     * @param {string} text - The text to draw.
     */
    draw(x, y, text) {
        if (y < 0 || y >= this.height) return;

        const chars = text.split('');
        for (let i = 0; i < chars.length; i++) {
            const currentX = x + i;
            if (currentX < 0 || currentX >= this.width) continue;
            this.#currentBuffer[y][currentX] = chars[i];
        }
    }

    /**
     * Generates the string of ANSI commands to update the client's screen.
     * Compares the current buffer with the previous one and only generates
     * commands for the parts that have changed.
     * @returns {string} The ANSI string to send to the client.
     */
    getDiff() {
        let output = '';
        let needsCursorMove = true;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.#currentBuffer[y][x] !== this.#previousBuffer[y][x]) {
                    if (needsCursorMove) {
                        // ANSI cursor position is 1-based
                        output += `\x1B[${y + 1};${x + 1}H`;
                    }
                    output += this.#currentBuffer[y][x];
                    this.#previousBuffer[y][x] = this.#currentBuffer[y][x];
                    needsCursorMove = false;
                } else {
                    needsCursorMove = true;
                }
            }
        }
        return output;
    }

    /**
     * Resizes the screen buffer and clears its contents.
     * @param {number} width - The new width.
     * @param {number} height - The new height.
     */
    resize(width, height) {
        this.width = width;
        this.height = height;

        const createGrid = () => Array.from({ length: height }, () => Array(width).fill(' '));

        this.#currentBuffer = createGrid();
        // Initialize previous buffer with a different value to force a full redraw on first render
        this.#previousBuffer = Array.from({ length: height }, () => Array(width).fill(null));
    }
}

/**
 * Represents a single connected Telnet client (a player).
 * This class extends EventEmitter to allow other parts of the application
 * to listen for events like 'input', 'disconnect', and 'resize'.
 *
 * @fires TelnetClient#input
 * @fires TelnetClient#disconnect
 * @fires TelnetClient#resize
 */
export default class TelnetClient extends EventEmitter {
    /** @type {string} */
    id;
    /** @type {import('net').Socket} */
    #socket;
    /** @type {ScreenBuffer} */
    screen;
    /** @type {string | null} */
    entityId = null;

    /**
     * Creates an instance of TelnetClient.
     * @param {import('net').Socket} socket - The raw Node.js TCP socket for the client.
     */
    constructor(socket) {
        super();
        this.id = uuidv4();
        this.#socket = socket;
        this.screen = new ScreenBuffer();

        this.#init();
    }

    /**
     * Initializes the client, sets up event listeners, and starts Telnet negotiation.
     * @private
     */
    #init() {
        this.#socket.on('data', (data) => this.#handleData(data));
        this.#socket.on('error', (err) => {
            logger.warn(`[TelnetClient ${this.id}] Socket error: ${err.message}`);
            this.disconnect();
        });
        this.#socket.on('close', () => {
            logger.info(`[TelnetClient ${this.id}] Connection closed.`);
            this.emit('disconnect');
        });

        this.#negotiate();
    }

    /**
     * Performs initial Telnet option negotiation to set up the client's terminal.
     * We request the client to suppress go-ahead, echo characters, and report its window size.
     * @private
     */
    #negotiate() {
        // We WILL suppress go-ahead, client should DO it.
        // We WILL echo, client should DO it.
        // We want to DO NAWS (Negotiate About Window Size), client should WILL it.
        const negotiationSequence = Buffer.from([
            TELNET.IAC, TELNET.WILL, TELNET.SUPPRESS_GO_AHEAD,
            TELNET.IAC, TELNET.WILL, TELNET.ECHO,
            TELNET.IAC, TELNET.DO, TELNET.NAWS,
        ]);
        this.send(negotiationSequence);
    }

    /**
     * Handles raw data received from the socket, parsing it for Telnet commands or user input.
     * @param {Buffer} data - The raw data buffer from the socket.
     * @private
     */
    #handleData(data) {
        // This is a simplified parser. A production-grade one would be a state machine.
        let i = 0;
        while (i < data.length) {
            if (data[i] === TELNET.IAC) {
                // It's a Telnet command sequence
                const command = data[i + 1];
                const option = data[i + 2];
                if (command === TELNET.WILL && option === TELNET.NAWS) {
                    // Client agrees to negotiate window size. We don't need to do anything here,
                    // but we wait for the sub-negotiation packet.
                } else if (command === 250) { // Sub-negotiation (SB)
                    // This is likely a NAWS response. Format: IAC SB NAWS <16-bit width> <16-bit height> IAC SE
                    if (option === TELNET.NAWS && data.length >= i + 9) {
                        const width = data.readUInt16BE(i + 3);
                        const height = data.readUInt16BE(i + 5);
                        this.#handleResize(width, height);
                        i += 8; // Move past the NAWS response
                    }
                }
                // Skip the 3-byte command sequence (IAC, command, option)
                i += 3;
            } else {
                // It's user input
                const input = data.subarray(i);
                this.#parseInput(input);
                break; // Assume rest of buffer is part of the same input sequence
            }
        }
    }

    /**
     * Parses user input, including special keys like arrows, and emits an 'input' event.
     * @param {Buffer} buffer - The buffer containing user input.
     * @private
     */
    #parseInput(buffer) {
        const s = buffer.toString('utf-8');
        let key;

        // Common escape sequences
        if (s === '\x1b[A') key = 'ArrowUp';
        else if (s === '\x1b[B') key = 'ArrowDown';
        else if (s === '\x1b[C') key = 'ArrowRight';
        else if (s === '\x1b[D') key = 'ArrowLeft';
        else if (s === '\r' || s === '\n' || s === '\r\n') key = 'Enter';
        else if (s === '\x1b') key = 'Escape';
        else if (s === '\x03') key = 'Ctrl-C'; // Handle Ctrl+C gracefully
        else {
            // For other keys, just use the character itself, filtering out non-printables.
            const charCode = s.charCodeAt(0);
            if (charCode >= 32 && charCode <= 126) {
                key = s;
            } else {
                // Unhandled control character, ignore for now.
                logger.debug(`[TelnetClient ${this.id}] Unhandled input sequence: ${JSON.stringify(s)}`);
                return;
            }
        }

        if (key === 'Ctrl-C') {
            this.disconnect();
            return;
        }

        /**
         * @event TelnetClient#input
         * @type {object}
         * @property {string} key - The parsed key name (e.g., 'ArrowUp', 'k', 'Enter').
         */
        this.emit('input', { key });
    }

    /**
     * Handles a window resize event from the client.
     * @param {number} width - The new terminal width.
     * @param {number} height - The new terminal height.
     * @private
     */
    #handleResize(width, height) {
        if (width > 0 && height > 0 && (this.screen.width !== width || this.screen.height !== height)) {
            logger.info(`[TelnetClient ${this.id}] Resized to ${width}x${height}`);
            this.screen.resize(width, height);
            /**
             * @event TelnetClient#resize
             * @type {object}
             * @property {number} width - The new terminal width.
             * @property {number} height - The new terminal height.
             */
            this.emit('resize', { width, height });
            this.clearScreen();
        }
    }

    /**
     * Sends raw data to the client's socket.
     * @param {string | Buffer} data - The data to send.
     */
    send(data) {
        if (this.#socket.writable) {
            this.#socket.write(data);
        }
    }

    /**
     * Clears the client's terminal screen and moves the cursor to the top-left.
     */
    clearScreen() {
        this.send(ANSI.CLEAR_SCREEN + ANSI.CURSOR_HOME);
    }

    /**
     * Renders the screen buffer to the client.
     * It first prepares the terminal, then sends only the changed parts of the screen,
     * and finally moves the cursor home to prevent it from appearing at the end of the output.
     */
    render() {
        const diff = this.screen.getDiff();
        if (diff) {
            // Hide cursor, send diff, then move cursor to a known location (home).
            // Hiding the cursor during updates reduces flicker.
            const output = ANSI.HIDE_CURSOR + diff + ANSI.CURSOR_HOME;
            this.send(output);
        }
    }

    /**
     * Gracefully disconnects the client.
     */
    disconnect() {
        if (this.#socket && !this.#socket.destroyed) {
            try {
                // Restore terminal settings before closing
                this.send(ANSI.SHOW_CURSOR);
                this.#socket.end();
            } catch (error) {
                logger.error(`[TelnetClient ${this.id}] Error during disconnect: ${error.message}`);
                this.#socket.destroy(); // Force close on error
            }
        }
    }
}