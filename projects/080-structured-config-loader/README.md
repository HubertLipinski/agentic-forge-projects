# Structured Config Loader

A zero-dependency Node.js library that loads, validates, and merges application configuration from multiple sources (files, environment variables, command-line arguments) into a single, structured object. Ideal for developers who need a robust, predictable, and source-prioritized configuration management solution without a complex setup.

## Features

-   **Multiple Sources**: Load config from JSON, YAML, and `.env` files.
-   **Environment & CLI**: Parse command-line arguments and environment variables with support for nested keys.
-   **Prioritized Merging**: Merge all sources in a predictable order: Command-line Arguments > Environment Variables > Files > Defaults.
-   **Schema Validation**: Validate the final configuration against a JSON Schema using Ajv.
-   **Type Coercion**: Automatically convert string values from `env` and `argv` to their correct types (e.g., `'true'` -> `true`, `'150'` -> `150`).
-   **Immutable**: Returns a deeply frozen configuration object to prevent runtime mutations.
-   **Zero-Dependency Mindset**: Core logic has no external dependencies. Relies on battle-tested libraries (`yargs-parser`, `dotenv`, `ajv`, `js-yaml`) for parsing and validation.

## Installation

Install the package using npm:

```bash
npm install structured-config-loader
```

## Usage

The primary API is the `loadConfig` function, which asynchronously loads, merges, and validates your configuration.

### Basic API Usage

Create a script (e.g., `start.js`) and use `loadConfig` to get your application's configuration.

```javascript
// start.js
import { loadConfig } from 'structured-config-loader';
import schema from './config.schema.json' assert { type: 'json' };

async function startApp() {
  try {
    const config = await loadConfig({
      schema,
      // The loader will automatically search for 'config.json', 'config.yaml', etc.
      // and '.env' in the current directory.
    });

    console.log('Configuration loaded successfully!');
    console.log(`Server will run on http://${config.server.host}:${config.server.port}`);
    // ... start your application with the config object
  } catch (error) {
    console.error('Failed to load configuration:', error.message);
    process.exit(1);
  }
}

startApp();
```

### Source Prioritization

The library merges sources in a strict, ascending priority order. Higher priority sources will always override lower ones.

1.  **Defaults** (Lowest priority): A default object provided in code.
2.  **Files**: Configuration from files like `config.yaml` or `config.json`.
3.  **Environment Variables**: Values from `.env` files and `process.env`.
4.  **Command-line Arguments** (Highest priority): Flags passed when running the script.

### Environment Variable Parsing

Environment variables can be mapped to nested configuration objects. By default, the library uses a `__` (double underscore) separator.

```bash
# In your .env file or shell environment
# This maps to { database: { host: 'db.example.com' } }
APP_DATABASE__HOST=db.example.com
APP_DATABASE__PORT=5432
```

### Command-Line Argument Parsing

Command-line arguments are parsed using dot notation to create nested objects.

```bash
node start.js --server.port=9090 --log.level=debug
```

This command will override `server.port` to `9090` and `log.level` to `debug`.

## Examples

### Example 1: Basic Loading

This example shows loading from a YAML file, an `.env` file, and command-line arguments, then validating against a schema.

**`config.yaml`**
```yaml
server:
  host: "0.0.0.0"
log:
  level: "info"
```

**`.env`**
```
# Override log level and provide a required value
LOG__LEVEL=warn
DATABASE__PASSWORD=secret
```

**`config.schema.json`**
```json
{
  "type": "object",
  "properties": {
    "server": {
      "type": "object",
      "properties": {
        "host": { "type": "string", "default": "localhost" },
        "port": { "type": "integer", "default": 8080 }
      }
    },
    "log": {
      "type": "object",
      "properties": { "level": { "type": "string", "enum": ["info", "warn", "debug"] } }
    },
    "database": {
      "type": "object",
      "properties": { "password": { "type": "string" } },
      "required": ["password"]
    }
  },
  "required": ["database"]
}
```

**`index.js`**
```javascript
import { loadConfig } from 'structured-config-loader';
import schema from './config.schema.json' assert { type: 'json' };

const config = await loadConfig({
  schema,
  files: ['./config.yaml'],
  env: { prefix: '', separator: '__' }, // Use '__' separator without a prefix
});

console.dir(config, { depth: null });
```

**Run Command:**
```bash
node index.js --server.port=3000
```

**Expected Output:**
The final configuration object reflects the priority merge: `argv` > `env` > `file` > `schema default`.

```js
{
  server: { host: '0.0.0.0', port: 3000 }, // port from CLI, host from YAML
  log: { level: 'warn' }, // from .env (overrides YAML)
  database: { password: 'secret' } // from .env
}
```

### Example 2: Handling Validation Errors

If the configuration fails to meet the schema's requirements, a `ConfigValidationError` is thrown with detailed information.

Let's say the `.env` file is missing the required `DATABASE__PASSWORD`.

**Run Command:**
```bash
node index.js --server.port=3000
```

**Expected Output:**
```
Failed to load configuration: Configuration validation failed with 1 error(s): [/database]: must have required property 'password'
```

## License

MIT