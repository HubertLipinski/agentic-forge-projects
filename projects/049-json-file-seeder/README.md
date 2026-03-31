# JSON File Seeder

A lightweight, zero-dependency CLI tool for seeding a database with data from JSON files. It reads a directory of JSON files, validates them against a simple schema, and inserts them into a specified collection or table using a provided database client. Ideal for developers needing a quick way to populate development or test databases without writing custom scripts.

## Features

- **Flexible Data Sources**: Seed data from a single JSON file or a directory of files.
- **Multiple Formats**: Supports both array-of-objects and single-object JSON file formats.
- **Pluggable Clients**: Easily extendable architecture for database clients. Comes with PostgreSQL and MongoDB support out of the box.
- **Data Validation**: Optional JSON Schema validation for each record before insertion using [Ajv](https://ajv.js.org/).
- **Dry-Run Mode**: Preview which files will be processed and how many records would be inserted without writing to the database.
- **CLI Driven**: Fully configurable via command-line arguments.
- **Clear Logging**: See clear, timestamped progress for each file processed.

## Installation

You can use the seeder by cloning the repository and installing its dependencies.

```bash
# Clone the repository
git clone https://github.com/your-username/json-file-seeder.git

# Navigate into the project directory
cd json-file-seeder

# Install dependencies
npm install

# (Optional) Link the binary to your path for global access
npm link
```

After linking, you can use `json-file-seeder` directly in your terminal. Otherwise, you can run it from the project root using `node bin/seed.js`.

## Usage

The CLI requires a path to your data, a client type, and a connection string. The name of the JSON file (e.g., `users.json`) is used as the target table or collection name (`users`).

### Command-Line Interface

```
json-file-seeder --path <dir|file> --client <type> --connectionString <string> [options]
```

### Arguments

| Argument             | Alias | Description                                                        | Required |
| -------------------- | ----- | ------------------------------------------------------------------ | -------- |
| `--path`             | `-p`  | Path to a directory of JSON files or a single JSON file.           | **Yes**  |
| `--client`           | `-c`  | Database client type. Supported: `mongodb`, `postgres`.            | **Yes**  |
| `--connectionString` | `--cs`| Database connection string.                                        | **Yes**  |
| `--schema`           | `-s`  | Path to a JSON Schema file for record validation.                  | No       |
| `--dry-run`          | `-d`  | Simulate the process without writing to the database.              | No       |
| `--help`             | `-h`  | Show the help message.                                             | No       |
| `--version`          | `-v`  | Show the version number.                                           | No       |

## Examples

### 1. Seed a MongoDB Database from a Directory

This command reads all `.json` files in the `examples/data` directory and inserts their contents into a MongoDB database named `testdb`. For `users.json`, data will be inserted into the `users` collection.

```bash
json-file-seeder \
  --path ./examples/data \
  --client mongodb \
  --connectionString "mongodb://localhost:27017/testdb"
```

#### Expected Output:

```
2024-04-21T12:00:00.000Z INFO  Starting JSON file seeder...
2024-04-21T12:00:00.001Z INFO  Initializing 'mongodb' client...
2024-04-21T12:00:00.100Z INFO  Successfully connected to MongoDB database: testdb
2024-04-21T12:00:00.101Z INFO  Scanning directory: /path/to/project/examples/data
2024-04-21T12:00:00.105Z INFO  Processing file: /path/to/project/examples/data/products.json
2024-04-21T12:00:00.106Z INFO  Inserting 5 record(s) into target 'products'...
2024-04-21T12:00:00.150Z INFO  Successfully inserted 5 record(s) into 'products'.
2024-04-21T12:00:00.151Z INFO  Processing file: /path/to/project/examples/data/users.json
2024-04-21T12:00:00.152Z INFO  Inserting 5 record(s) into target 'users'...
2024-04-21T12:00:00.180Z INFO  Successfully inserted 5 record(s) into 'users'.
2024-04-21T12:00:00.181Z INFO  --------------------
2024-04-21T12:00:00.181Z INFO  Seeding Summary:
2024-04-21T12:00:00.181Z INFO  - Files processed: 2
2024-04-21T12:00:00.181Z INFO  - Total records inserted: 10
2024-04-21T12:00:00.181Z INFO  --------------------
2024-04-21T12:00:00.182Z INFO  Seeding process completed successfully.
2024-04-21T12:00:00.185Z INFO  MongoDB connection closed.
```

### 2. Seed a PostgreSQL Table with Validation (Dry Run)

This command processes a single file (`users.json`), validates each record against `user-schema.json`, and shows what would happen without actually inserting data into the PostgreSQL database. This is useful for verifying your setup and data integrity.

**Note**: For PostgreSQL, ensure the target table (e.g., `users`) exists and its columns match the keys in your JSON data.

```bash
json-file-seeder \
  --path ./examples/data/users.json \
  --client postgres \
  --connectionString "postgresql://user:pass@localhost:5432/testdb" \
  --schema ./examples/schemas/user-schema.json \
  --dry-run
```

#### Expected Output:

```
2024-04-21T12:05:00.000Z INFO  Starting JSON file seeder...
2024-04-21T12:05:00.001Z WARN  DRY RUN mode enabled. No data will be written to the database.
2024-04-21T12:05:00.002Z INFO  Schema validation enabled.
2024-04-21T12:05:00.003Z INFO  Initializing 'postgres' client...
2024-04-21T12:05:00.100Z INFO  Successfully connected to PostgreSQL database "testdb" on localhost:5432
2024-04-21T12:05:00.105Z INFO  Successfully loaded and compiled schema: /path/to/project/examples/schemas/user-schema.json
2024-04-21T12:05:00.110Z INFO  Processing file: /path/to/project/examples/data/users.json
2024-04-21T12:05:00.111Z INFO  Validating 5 record(s) for target 'users'...
2024-04-21T12:05:00.115Z INFO  [DRY RUN] Would insert 5 record(s) into target 'users'.
2024-04-21T12:05:00.116Z INFO  --------------------
2024-04-21T12:05:00.116Z INFO  Seeding Summary:
2024-04-21T12:05:00.116Z INFO  - Files processed: 1
2024-04-21T12:05:00.116Z INFO  - Total records to be inserted: 5
2024-04-21T12:05:00.116Z INFO  --------------------
2024-04-21T12:05:00.117Z INFO  Seeding process completed successfully.
2024-04-21T12:05:00.120Z INFO  PostgreSQL connection closed.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.