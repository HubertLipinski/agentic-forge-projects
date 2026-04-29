/**
 * @file src/index.js
 * @description The main public entry point for the llm-stream-multiplexer library.
 *
 * This file exports the primary `Multiplexer` class, making it available for
 * consumers of the library. It serves as the gateway to the library's
 * functionality. By convention, any types or helper functions intended for
 * public use would also be exported from here.
 */

import { Multiplexer } from './multiplexer.js';

/**
 * @typedef {import('./source-stream-handler.js').SourceStreamState} SourceStreamState
 * The state object for a single source stream, providing details like its ID,
 * status, accumulated content, and any errors.
 */

/**
 * @typedef {import('./source-stream-handler.js').StreamStatus} StreamStatus
 * The lifecycle status of a source stream ('pending', 'streaming', 'completed', 'error', 'timed_out').
 */

/**
 * @typedef {import('fast-json-patch').Operation} JsonPatchOperation
 * A single JSON Patch operation as defined by RFC 6902. The multiplexer yields
 * arrays of these operations.
 */

export { Multiplexer };