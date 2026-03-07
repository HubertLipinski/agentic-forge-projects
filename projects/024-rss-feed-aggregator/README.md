# RSS Feed Aggregator

A simple Node.js CLI tool and library to fetch, parse, and aggregate multiple RSS or Atom feeds into a single, chronologically sorted JSON output. Ideal for developers creating dashboards, content hubs, or personal news readers without complex database setups.

## Features

-   **Concurrent Fetching**: Fetches multiple RSS/Atom feeds in parallel for maximum speed.
-   **Robust Parsing**: Parses XML feed data into a standardized JavaScript object format using `rss-parser`.
-   **Aggregation & Sorting**: Merges items from all feeds into a single array, sorted chronologically (newest first).
-   **Error Handling**: Gracefully handles failed requests or parsing errors for individual feeds without stopping the entire process.
-   **Configurable Timeouts**: Set custom request timeouts to prevent hangs from unresponsive servers.
-   **Dual-Mode**: Use it as a powerful CLI tool (`aggregate-feeds`) or as a library in your own Node.js projects.

## Installation

You can use the CLI directly with `npx` without installation, or install it globally.

**Global Installation (Recommended for CLI)**

```bash
npm install -g rss-feed-aggregator
```

**Local Installation (For Programmatic Use)**

```bash
npm install rss-feed-aggregator
```

Alternatively, you can clone the repository for development:

```bash
git clone https://github.com/your-username/rss-feed-aggregator.git
cd rss-feed-aggregator
npm install
```

## Usage

### Command-Line Interface (CLI)

The CLI takes a list of feed URLs, aggregates them, and prints the resulting JSON to standard output.

**Basic Command**

```bash
aggregate-feeds <feedUrl1> [feedUrl2] ...
```

**Options**

-   `--timeout, -t`: Request timeout in milliseconds for each feed. (Default: `10000`)
-   `--pretty, -p`: Output JSON in a human-readable (pretty-printed) format. (Default: `false`)
-   `--help, -h`: Show help information.
-   `--version, -v`: Show version number.

### Programmatic API

Import the `aggregateFeeds` function to use the aggregator in your Node.js application.

```javascript
import { aggregateFeeds } from 'rss-feed-aggregator';

const feedUrls = [
  'https://www.theverge.com/rss/index.xml',
  'https://hnrss.org/frontpage'
];

async function getNews() {
  try {
    // The function returns an object with `items` and `errors` arrays.
    const { items, errors } = await aggregateFeeds(feedUrls, { timeout: 5000 });

    console.log('Aggregated Items:', items);

    if (errors.length > 0) {
      console.error('Feeds that failed:', errors);
    }
  } catch (error) {
    console.error('A critical error occurred:', error);
  }
}

getNews();
```

## Examples

### 1. Basic CLI Usage

Aggregate two feeds and output compact JSON.

**Command:**

```bash
aggregate-feeds https://www.theverge.com/rss/index.xml https://www.wired.com/feed/rss
```

**Output (truncated for brevity):**

```json
{"items":[{"title":"Latest Post from The Verge","link":"...","isoDate":"2023-10-27T18:00:00.000Z",...},{"title":"Latest Post from Wired","link":"...","isoDate":"2023-10-27T17:45:00.000Z",...}],"errors":[]}
```

### 2. CLI with Pretty-Printing and Error Handling

Aggregate multiple feeds, including one that will fail, and format the output for readability.

**Command:**

```bash
aggregate-feeds --pretty https://hnrss.org/frontpage https://example.com/non-existent-feed.xml
```

**Output:**

The command will print a warning to `stderr` for the failed feed:

```
Encountered errors while processing some feeds:
- Failed to process https://example.com/non-existent-feed.xml: Network error fetching feed from https://example.com/non-existent-feed.xml: getaddrinfo ENOTFOUND example.com
```

And the successful data will be printed to `stdout`:

```json
{
  "items": [
    {
      "creator": "some_user",
      "title": "A Cool Hacker News Post",
      "link": "https://news.ycombinator.com/item?id=...",
      "pubDate": "Fri, 27 Oct 2023 19:15:07 +0000",
      "content": "...",
      "contentSnippet": "...",
      "guid": "https://news.ycombinator.com/item?id=...",
      "isoDate": "2023-10-27T19:15:07.000Z",
      "feed": {
        "title": "Hacker News: Front Page",
        "link": "https://news.ycombinator.com/"
      }
    }
  ],
  "errors": [
    {
      "url": "https://example.com/non-existent-feed.xml",
      "reason": "Network error fetching feed from https://example.com/non-existent-feed.xml: getaddrinfo ENOTFOUND example.com"
    }
  ]
}
```

### Output JSON Structure

Each item in the `items` array is a normalized object with the following key properties:

-   `title` (string): The title of the article.
-   `link` (string): The direct URL to the article.
-   `isoDate` (string): The publication date in ISO 8601 format (e.g., `"2023-10-27T19:15:07.000Z"`). Used for sorting.
-   `creator` (string | null): The author of the article. Normalized from `dc:creator`, `creator`, or `author` fields.
-   `content` (string): The full content of the item, often HTML.
-   `contentSnippet` (string): A plain text snippet of the content.
-   `feed` (object): Metadata about the source feed.
    -   `title` (string): The title of the source RSS/Atom feed.
    -   `link` (string): The link to the source feed's homepage.

## License

[MIT](LICENSE)