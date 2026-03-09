# Auto-Config Loader

A zero-configuration, cascading configuration loader for Node.js applications. It automatically finds and merges configuration from multiple sources like environment variables, .env files, and JSON/YAML files in a predefined order of precedence. Ideal for developers who need a robust configuration setup without manual file path management, especially in monorepos or containerized environments.

## Features

-   **Automatic Discovery**: Finds config files (`config.json`, `config.yaml`, etc.) by searching upwards from the current directory. No manual paths needed.
-   **Cascading Merge Strategy**: A clear precedence order ensures predictable configuration. Environment variables override `.env` files, which override project files, which override user-home files.
-   **Multiple Formats**: Natively supports JSON, YAML (`.yml`, `.yaml`), and `.env` files.
-   **Environment Overrides**: Automatically loads and merges environment-specific files like `config.production.json` when `NODE_ENV=production`.
-   **Dot Notation Access**: A convenient `config.get('database.host')` method for safely accessing nested properties with default value support.
-   **Prefixed Environment Variables**: Parses environment variables like `APP__DB__HOST` into a nested object (`{ db: { host: ... } }`).
-   **Schema Validation**: Optionally validate the final configuration against a simple schema to catch errors early.
-   **Immutable**: The final configuration object is frozen to prevent accidental runtime modifications.

## Installation

Install the package using npm:

```bash
npm install auto-config-loader
```

## Usage

The primary export is an asynchronous function `loadConfig`. Import it and call it at the start of your application.

```javascript
// index.js
import loadConfig from 'auto-config-loader';

async function startApp() {
  try {
    const config = await loadConfig({
      // Optional: Only load environment variables prefixed with 'MYAPP__'
      envPrefix: 'MYAPP',
      // Optional: Define a schema to validate the config
      schema: {
        server: {
          port: { type: 'number', required: true }
        },
        database: {
          host: { type: 'string', required: true }
        }
      }
    });

    console.log('Configuration loaded successfully!');
    console.log(`Server Port: ${config.get('server.port', 8080)}`);
    console.log(`Database Host: ${config.server.host}`); // Direct access works too

    // Your application logic here...
    // const server = createServer(config);
    // server.listen(config.server.port);

  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

startApp();
```

### Configuration Precedence

The loader merges sources in the following order, with later sources overriding earlier ones (from lowest to highest precedence):

1.  **Defaults Object**: The `defaults` object passed to `loadConfig(options)`.
2.  **User Home Directory Files**: Files like `~/.config.json` or `~/.config.yaml`.
3.  **Project Files**: Files found by searching upwards from the start directory (`config.json`, `config.production.yaml`, etc.). Files in deeper subdirectories override files in parent directories.
4.  **.env Files**: Variables from `.env` and `.env.[NODE_ENV]` files.
5.  **Environment Variables**: Prefixed variables from `process.env` (e.g., `APP__SERVER__PORT=8080`).

## Examples

### Example 1: Basic Loading

Imagine this file structure:

```
/path/to/project/
├── config.json
└── index.js
```

**`config.json`**
```json
{
  "server": {
    "host": "localhost",
    "port": 3000
  }
}
```

**`index.js`**
```javascript
import loadConfig from 'auto-config-loader';

const config = await loadConfig();

console.log(config.get('server.port')); // 3000
console.log(config.server.host); // "localhost"
```

### Example 2: Environment Overrides and `.env`

Now, let's add an environment-specific file and an environment variable.

```
/path/to/project/
├── config.json
├── config.production.json
└── index.js
```

**`config.production.json`**
```json
{
  "server": {
    "port": 80
  }
}
```

Run the application with `NODE_ENV` and a prefixed environment variable:

```bash
NODE_ENV=production MYAPP__SERVER__HOST=0.0.0.0 node index.js
```

**`index.js`**
```javascript
import loadConfig from 'auto-config-loader';

const config = await loadConfig({ envPrefix: 'MYAPP' });

// config.server.host is "0.0.0.0" (from environment variable)
// config.server.port is 80 (from config.production.json)
console.log(`Server running at http://${config.server.host}:${config.server.port}`);
```

**Expected Output:**
```
Server running at http://0.0.0.0:80
```

### Example 3: Schema Validation

This example shows how the loader can prevent your app from starting with invalid configuration.

**`index.js`**
```javascript
import loadConfig from 'auto-config-loader';

const schema = {
  server: {
    port: { type: 'number', required: true }
  },
  apiKey: { type: 'string', required: true }
};

try {
  // Assume `config.json` only defines `server.port`, but not `apiKey`.
  const config = await loadConfig({ schema });
} catch (error) {
  // The `loadConfig` call will throw a ConfigValidationError.
  console.error(error.message);
}
```

**Expected Output:**
```
[Auto-Config-Loader] Failed to load configuration: Configuration validation failed.
Configuration validation failed.
- Missing required configuration key: 'apiKey'.
```

## License

[MIT](LICENSE)