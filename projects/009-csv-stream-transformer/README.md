# CSV Stream Transformer

A lightweight, stream-based Node.js library for transforming large CSV files with minimal memory usage. It provides a configurable pipeline for mapping columns, filtering rows, and applying custom transformations, making it ideal for ETL tasks, data cleaning, and preprocessing data for ingestion into databases or other systems.

## Features

-   **Stream-Based Processing**: Handles large files (>1GB) with low, constant memory overhead.
-   **Declarative Configuration**: Define complex transformations in a simple JSON file.
-   **Row Filtering**: Filter rows based on column values.
-   **Column Manipulation**: Map, rename, and remove columns with ease.
-   **Value Transformation**: Use built-in functions (e.g., `toUpperCase`, `toFixed`) or provide your own custom logic.
-   **Schema Validation**: Configuration files are validated to prevent common errors.
-   **Command-Line Interface (CLI)**: Execute transformations directly from your shell.
-   **Programmatic API**: Integrate the transformer into your Node.js applications.

## Installation

You can use the tool directly via `npx` or install it globally:

```bash
# Install globally to use the `transform-csv` command anywhere
npm install -g csv-stream-transformer
```

Alternatively, to use it as a library in your project:

```bash
npm install csv-stream-transformer
```

## Usage

### Command-Line Interface (CLI)

The primary way to use the tool is via the `transform-csv` command. You need a source CSV file and a JSON configuration file.

**Syntax:**

```bash
transform-csv [input-file] [output-file] --config <path-to-config.json>
```

-   `[input-file]`: Path to the source CSV. If omitted, reads from `stdin`.
-   `[output-file]`: Path for the transformed CSV. If omitted, writes to `stdout`.
-   `--config, -c`: **(Required)** Path to the JSON transformation configuration file.

**Example:**

```bash
transform-csv input.csv output.csv --config ./transform-config.json
```

You can also use it with pipes:

```bash
cat input.csv | transform-csv --config ./transform-config.json > output.csv
```

### Programmatic API

You can also integrate the transformer directly into your Node.js application.

```javascript
import { transformCsv } from 'csv-stream-transformer';
import { Readable } from 'stream';

// Example using in-memory streams
async function run() {
  const sourceStream = Readable.from([
    'id,name,email\n',
    '1,John Doe,john.doe@example.com\n',
    '2,Jane Smith,JANE.SMITH@example.com\n',
  ]);

  const config = {
    mapping: [
      { from: 'id', to: 'userId' },
      { from: 'name' },
      {
        from: 'email',
        transform: [{ name: 'toLowerCase' }],
      },
    ],
  };

  try {
    await transformCsv({
      source: sourceStream,
      destination: process.stdout, // Write to the console
      config: config,
    });
  } catch (error) {
    console.error('Transformation failed:', error);
  }
}

run();
```

## Configuration File

The transformation logic is defined in a JSON file. Here is a comprehensive example:

`config.json`:
```json
{
  "csvParseOptions": {
    "delimiter": ",",
    "from_line": 2
  },
  "csvStringifyOptions": {
    "header": true,
    "delimiter": "\t"
  },
  "filter": [
    {
      "column": "status",
      "equals": "active"
    }
  ],
  "mapping": [
    {
      "from": "user_id",
      "to": "id"
    },
    {
      "from": "first_name",
      "to": "firstName",
      "transform": [
        { "name": "trim" },
        { "name": "toUpperCase" }
      ]
    },
    {
      "from": "balance",
      "to": "accountBalance",
      "transform": [
        { "name": "replace", "params": ["$", ""] },
        { "name": "parseFloat" },
        { "name": "toFixed", "params": [2] }
      ]
    },
    {
      "from": "notes",
      "transform": [
        { "name": "default", "params": ["N/A"] }
      ]
    }
  ]
}
```

-   `csvParseOptions`: Options passed directly to `csv-parse`. See [csv-parse documentation](https://csv.js.org/parse/options/).
-   `csvStringifyOptions`: Options passed directly to `csv-stringify`. See [csv-stringify documentation](https://csv.js.org/stringify/options/).
-   `filter`: An array of rules to filter rows. A row is kept only if it satisfies **all** rules.
-   `mapping`: An array defining the output columns.
    -   `from`: The original column name.
    -   `to`: The new column name (optional, defaults to `from`).
    -   `transform`: A chain of value transformations to apply.

## Examples

### Example 1: Basic Renaming and Filtering

Given the following `input.csv`:

```csv
id,name,status,email
1,Alice,active,alice@test.com
2,Bob,inactive,bob@test.com
3,Charlie,active,charlie@test.com
```

And this `config.json`:

```json
{
  "filter": [
    { "column": "status", "equals": "active" }
  ],
  "mapping": [
    { "from": "id", "to": "userId" },
    { "from": "name" },
    { "from": "email" }
  ]
}
```

Running the command:

```bash
transform-csv input.csv --config config.json
```

Will produce the following `output.csv`:

```csv
userId,name,email
1,Alice,alice@test.com
3,Charlie,charlie@test.com
```

### Example 2: Value Transformations

Given the following `users.csv`:

```csv
full_name,join_date,balance
  john smith  ,2023-05-10,$150.758
  jane doe  ,2023-06-12,$99
```

And this `config.json`:

```json
{
  "mapping": [
    {
      "from": "full_name",
      "to": "name",
      "transform": [
        { "name": "trim" },
        { "name": "toUpperCase" }
      ]
    },
    {
      "from": "balance",
      "to": "accountBalance",
      "transform": [
        { "name": "replace", "params": ["$", ""] },
        { "name": "toFixed", "params": [2] }
      ]
    }
  ]
}
```

Running the command:

```bash
transform-csv users.csv --config config.json
```

Will produce the following `output.csv`:

```csv
name,accountBalance
JOHN SMITH,150.76
JANE DOE,99.00
```

## License

[MIT](LICENSE)