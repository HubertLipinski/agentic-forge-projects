# JSON Schema Inferer

A zero-dependency Node.js utility that automatically generates a draft JSON Schema from a sample JSON object or an array of JSON objects. Ideal for developers who need to quickly bootstrap schema validation for APIs or data processing pipelines without writing the schema by hand.

## Features

-   **Generates Draft Schema**: Creates a JSON Schema (version 2020-12) from a single JSON object.
-   **Comprehensive Merging**: Merges multiple JSON objects to create a more robust schema, correctly identifying optional properties and mixed types.
-   **Accurate Type Inference**: Correctly infers types: `string`, `number`, `integer`, `boolean`, `null`, `object`, and `array`.
-   **Recursive Processing**: Handles deeply nested objects and arrays.
-   **Command Line Interface (CLI)**: Generate schemas directly from JSON files in your terminal.
-   **Programmatic API**: Easily integrate schema inference into your own Node.js scripts.
-   **Zero Dependencies**: Lightweight and easy to add to any project.

## Installation

You can install the package globally to use the CLI anywhere:

```bash
npm install -g json-schema-inferer
```

Or, add it as a development dependency to your project:

```bash
npm install --save-dev json-schema-inferer
```

Alternatively, you can clone the repository and install dependencies locally:

```bash
git clone https://github.com/your-username/json-schema-inferer.git
cd json-schema-inferer
npm install
```

## Usage

### Command-Line Interface (CLI)

The CLI is the quickest way to generate a schema from a JSON file.

**Basic Syntax:**

```bash
infer-schema <input-file> [options]
```

**Arguments:**

-   `<input-file>`: Path to the input JSON file. The file can contain a single JSON object or an array of JSON objects.

**Options:**

-   `-o, --output <file>`: Path to the output schema file. If omitted, the schema is printed to standard output.
-   `-i, --indent <number>`: Number of spaces for JSON output indentation (default: 2).
-   `-v, --version`: Display the version number.
-   `--help`: Display help and usage information.

### Programmatic API

You can also use the `infer` function directly in your Node.js code.

```javascript
import { infer } from 'json-schema-inferer';
import fs from 'node:fs';

// Your JSON data can be a single object or an array of objects
const jsonData = [
  { id: 1, name: 'Product A', price: 99.99 },
  { id: 2, name: 'Product B', price: 105.50, onSale: true }
];

try {
  // Infer the schema
  const schema = infer(jsonData);

  // Use the schema (e.g., write it to a file)
  fs.writeFileSync('product.schema.json', JSON.stringify(schema, null, 2));
  console.log('Schema generated successfully!');

} catch (error) {
  console.error('Error inferring schema:', error.message);
}
```

## Examples

### Example 1: CLI with a Single Object

Given an input file `user.json`:

```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "isActive": true,
  "profile": {
    "age": 30,
    "avatar": "https://example.com/avatar.png"
  }
}
```

Run the command:

```bash
infer-schema user.json
```

**Output (Schema printed to console):**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer"
    },
    "username": {
      "type": "string"
    },
    "email": {
      "type": "string"
    },
    "isActive": {
      "type": "boolean"
    },
    "profile": {
      "type": "object",
      "properties": {
        "age": {
          "type": "integer"
        },
        "avatar": {
          "type": "string"
        }
      },
      "required": [
        "age",
        "avatar"
      ]
    }
  },
  "required": [
    "email",
    "id",
    "isActive",
    "profile",
    "username"
  ]
}
```

### Example 2: CLI with an Array of Objects

This example demonstrates how optional properties and mixed types are handled.

Given an input file `logs.json`:

```json
[
  { "level": "info", "message": "User logged in", "userId": 123 },
  { "level": "error", "message": "Database connection failed", "errorCode": 500 },
  { "level": "info", "message": "Task completed", "userId": "abc" }
]
```

Run the command and save to a file:

```bash
infer-schema logs.json -o log.schema.json
```

**Output (contents of `log.schema.json`):**

The resulting schema correctly identifies that `level` and `message` are required, while `userId` and `errorCode` are optional. It also detects that `userId` can be either an `integer` or a `string`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "level": {
      "type": "string"
    },
    "message": {
      "type": "string"
    },
    "userId": {
      "type": [
        "integer",
        "string"
      ]
    },
    "errorCode": {
      "type": "integer"
    }
  },
  "required": [
    "level",
    "message"
  ]
}
```

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you'd like to contribute code, please fork the repository and submit a pull request.

1.  Fork the repository.
2.  Create a new branch: `git checkout -b my-feature-branch`
3.  Make your changes.
4.  Run tests: `npm test`
5.  Commit your changes: `git commit -am 'Add some feature'`
6.  Push to the branch: `git push origin my-feature-branch`
7.  Submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.