/**
 * @fileoverview Main entry point for the RSS Feed Aggregator library.
 *
 * This file serves as the public API for the package when used programmatically.
 * It exports the core `aggregateFeeds` function, allowing other Node.js
 * applications to easily consume the feed aggregation logic.
 *
 * By centralizing the main export here, we maintain a clean and predictable
 * interface for library users, separating the library's API from its internal
 * implementation details and the command-line interface.
 *
 * @module src/index
 * @example
 * import { aggregateFeeds } from 'rss-feed-aggregator';
 *
 * const feedUrls = [
 *   'https://www.theverge.com/rss/index.xml',
 *   'https://www.wired.com/feed/rss',
 * ];
 *
 * async function getAggregatedNews() {
 *   try {
 *     const { items, errors } = await aggregateFeeds(feedUrls, { timeout: 5000 });
 *     console.log('Aggregated Items:', items);
 *     if (errors.length > 0) {
 *       console.error('Errors encountered:', errors);
 *     }
 *   } catch (error) {
 *     console.error('A critical error occurred:', error);
 *   }
 * }
 *
 * getAggregatedNews();
 */

import { aggregateFeeds } from './core/aggregator.js';

// Export the primary function `aggregateFeeds` as the main entry point for the library.
// This allows consumers to import it directly: `import { aggregateFeeds } from 'rss-feed-aggregator';`
export { aggregateFeeds };

// For consumers who might prefer a default export, we can provide one as well.
// This offers flexibility in how the library is imported and used.
// e.g., `import aggregator from 'rss-feed-aggregator';`
// and then `aggregator.aggregateFeeds(...)`
// Or if we wanted the default to be the function itself: `export default aggregateFeeds;`
// For now, a named export is cleaner and more explicit.

// We can also export other useful utilities or constants if needed in the future,
// making this file the single source of truth for the library's public API.
// For example:
// export { DEFAULT_REQUEST_TIMEOUT } from './utils/constants.js';