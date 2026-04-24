/**
 * src/index.js
 *
 * This is the public entry point for the `pg-logical-streamer` library.
 * It exports the main `PgLogicalStream` client class, which is the primary
 * interface for users of this package.
 *
 * By centralizing exports here, we provide a clean and consistent way for
 * consumers to import the library's functionality.
 *
 * @example
 * import { PgLogicalStream } from 'pg-logical-streamer';
 *
 * const client = new PgLogicalStream({ ...options });
 * client.start();
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { PgLogicalStream } from './client.js';

// Export the main client class as the primary export.
export { PgLogicalStream };

// For users who might prefer a default export syntax, e.g., `import PgLogicalStreamer from '...'`
// This can be convenient but also potentially confusing, so we stick to named exports
// for clarity and consistency with ES module best practices.
// A named export is explicit and less prone to naming conflicts.
export default PgLogicalStream;