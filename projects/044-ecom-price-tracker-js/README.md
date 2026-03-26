# E-Commerce Price Tracker JS

A distributed, headless scraper designed to track product prices and stock availability across e-commerce sites. It uses a dynamic user-agent and proxy rotation strategy to avoid detection, with a pluggable architecture for defining site-specific extraction logic. Ideal for developers building price comparison tools, deal alert systems, or market research dashboards.

## Features

- **Distributed Job Processing**: Uses `p-queue` for configurable, concurrent scraping tasks.
- **Pluggable Architecture**: Easily define new site scrapers via simple YAML or JSON configuration files.
- **Anti-Detection**: Implements dynamic proxy and user-agent rotation from configurable lists.
- **Robust Data Extraction**: Leverages `cheerio` for high-performance HTML parsing and data extraction.
- **Schema Validation**: Ensures all site configurations are valid and complete using `ajv`.
- **Resilient Fetching**: Automatic retries with exponential backoff for failed requests.
- **Structured Output**: Generates clean, structured JSON output for easy integration with databases or APIs.
- **High-Performance HTTP**: Built on `undici`, Node.js's modern, high-performance HTTP/1.1 client.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/e-commerce-price-tracker-js.git
    cd e-commerce-price-tracker-js
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure your scraper:
    *   **Proxies (Optional)**: Copy `config/proxies.example.json` to `config/proxies.json` and add your proxy server URLs.
        ```bash
        cp config/proxies.example.json config/proxies.json
        ```
    *   **User-Agents (Optional)**: Copy `config/user-agents.example.json` to `config/user-agents.json` and add a list of user-agent strings.
        ```bash
        cp config/user-agents.example.json config/user-agents.json
        ```
    *   **Sites**: Add your own site definitions (e.g., `my-store.yaml`) to the `sites/` directory. See `sites/amazon-product.yaml` for an example.

## Usage

The scraper can be run directly from the command line by passing one or more product URLs as arguments. It will automatically find the correct site configuration based on the URL pattern.

### CLI

The primary way to use the tool is via the `track-prices` command (or by running `src/index.js` directly).

```bash
# Scrape a single product URL
npm start -- "https://www.bestbuy.com/site/sony-wh1000xm4-wireless-noise-cancelling-over-the-ear-headphones-black/6408356.p?skuId=6408356"

# Scrape multiple URLs in parallel
npm start -- "URL_1" "URL_2" "URL_3"

# Pipe the JSON output to a file
npm start -- "URL_1" "URL_2" > results.json
```

### Programmatic API

You can also integrate the scraper into your own Node.js application. The `examples/run-scraper.js` file demonstrates this pattern.

```javascript
// examples/run-scraper.js
import PQueue from 'p-queue';
import { loadSiteConfigs } from '../src/utils/config-loader.js';
import { initializeHttpClient } from '../src/core/http-client.js';
import { processJob } from '../src/core/job-processor.js';

// 1. Define target URLs
const TARGET_URLS = [
  'https://www.bestbuy.com/site/sony-wh1000xm4-wireless-noise-cancelling-over-the-ear-headphones-black/6408356.p?skuId=6408356',
  'https://www.amazon.com/dp/B0863FR3S9',
];

// 2. Initialize scraper
const [siteConfigs] = await Promise.all([
  loadSiteConfigs(),
  initializeHttpClient(),
]);

// 3. Create a queue and add jobs
const queue = new PQueue({ concurrency: 2 });

for (const url of TARGET_URLS) {
  const siteConfig = siteConfigs.find(c => new RegExp(c.urlPattern).test(url));
  if (siteConfig) {
    queue.add(() => processJob(url, siteConfig).then(console.log));
  }
}

await queue.onIdle();
console.log('All jobs finished.');
```

## Examples

### Example 1: Scrape a Best Buy Product

This command scrapes a single product from Best Buy.

**Command:**
```bash
npm start -- "https://www.bestbuy.com/site/sony-wh1000xm4-wireless-noise-cancelling-over-the-ear-headphones-black/6408356.p?skuId=6408356"
```

**Expected Output (Structure):**
```json
[
  {
    "url": "https://www.bestbuy.com/site/sony-wh1000xm4-wireless-noise-cancelling-over-the-ear-headphones-black/6408356.p?skuId=6408356",
    "site": "Best Buy",
    "timestamp": "2024-05-21T18:30:00.123Z",
    "data": {
      "name": "Sony - WH-1000XM4 Wireless Noise-Cancelling Over-the-Ear Headphones - Black",
      "price": 349.99,
      "isInStock": true
    },
    "error": null
  }
]
```

### Example 2: Scrape Multiple Products and Handle Failures

This command scrapes two URLs: one valid Amazon product and one URL that doesn't match any site configuration.

**Command:**
```bash
npm start -- "https://www.amazon.com/dp/B0863FR3S9" "https://www.example.com/product/123"
```

**Expected Output (Structure):**
```json
[
  {
    "url": "https://www.example.com/product/123",
    "site": "N/A",
    "timestamp": "2024-05-21T18:31:00.456Z",
    "data": null,
    "error": "No matching site configuration found."
  },
  {
    "url": "https://www.amazon.com/dp/B0863FR3S9",
    "site": "Amazon",
    "timestamp": "2024-05-21T18:31:02.789Z",
    "data": {
      "name": "Logitech MX Master 3S - Wireless Performance Mouse, Ergo, 8K DPI, Track on Glass, Quiet Clicks, USB-C, Bluetooth, Windows, Linux, Chrome - Graphite",
      "price": 99.99,
      "isInStock": true
    },
    "error": null
  }
]
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.