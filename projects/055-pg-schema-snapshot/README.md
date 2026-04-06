# pg-schema-snapshot

A lightweight, zero-dependency CLI tool for capturing and comparing snapshots of a PostgreSQL database schema. It generates a deterministic JSON representation of tables, columns, indexes, and constraints, allowing developers and DBAs to track schema changes over time, validate deployments, and ensure consistency across environments without relying on heavy migration frameworks.

## Features

-   **Connects to PostgreSQL** using standard connection strings or environment variables (e.g., `PGHOST`, `PGPASSWORD`).
-   **Generates Structured JSON:** Creates a sorted JSON snapshot of the database schema, including tables, columns, types, nullability, defaults, indexes, and foreign keys.
-   **Deterministic Output:** Ensures consistent hashing and comparison by sorting all schema elements.
-   **Schema Differ:** A `diff` command to compare two snapshot files and report additions, deletions, and modifications.
-   **Schema Filtering:** Supports including or excluding specific schemas (e.g., ignore `pg_catalog`).
-   **CI/CD Friendly:** CLI interface is perfect for integration into deployment and testing pipelines.
-   **Pure JavaScript:** Uses the `pg` driver with no native bindings required.

## Installation

You can install the tool globally via npm:

```bash
npm install -g pg-schema-snapshot
```

Alternatively, you can clone the repository and install dependencies locally for development:

```bash
git clone https://github.com/your-username/pg-schema-snapshot.git
cd pg-schema-snapshot
npm install
# Use the local executable
npm start -- <command>
# or
./bin/cli.js <command>
```

## Usage

The CLI has two primary commands: `capture` and `diff`.

### Configuration

The tool connects to your PostgreSQL database using the same environment variables as `psql` and other standard clients. Make sure these are set in your environment:

-   `PGHOST`: Database server host.
-   `PGPORT`: Port number.
-   `PGDATABASE`: Database name.
-   `PGUSER`: Username for authentication.
-   `PGPASSWORD`: Password for authentication.

Alternatively, you can set a single `DATABASE_URL` connection string.

### `capture`

Captures a snapshot of the database schema and saves it to a JSON file.

**Command:**

```bash
pg-schema-snapshot capture [output] [options]
```

**Arguments & Options:**

-   `[output]`: The path for the output JSON file. Defaults to `snapshot-YYYY-MM-DD.json`.
-   `-s, --schema <name>`: Schema(s) to include. Can be specified multiple times. (Default: `public`)
-   `-x, --exclude-schema <name>`: Schema(s) to exclude.

### `diff`

Compares two snapshot files and prints the differences to the console. It exits with code `0` if there are no differences, `1` if differences are found, and `2` for operational errors.

**Command:**

```bash
pg-schema-snapshot diff <file1> <file2>
```

**Arguments:**

-   `<file1>`: Path to the first (source/old) snapshot file.
-   `<file2>`: Path to the second (target/new) snapshot file.

## Examples

### Example 1: Capture the public schema

Capture the schema of the `public` schema and save it to `prod-schema.json`.

**Command:**

```bash
export PGHOST=db.production.com
export PGDATABASE=main_db
export PGUSER=reporter
export PGPASSWORD=secret

pg-schema-snapshot capture prod-schema.json --schema public
```

**Output:**

```
Capturing schema snapshot...
  - Including schemas: public
  - Excluding schemas: (none)
  - Output file: /path/to/your/project/prod-schema.json
Successfully connected to PostgreSQL.
PostgreSQL client disconnected.

✅ Snapshot successfully captured and saved to /path/to/your/project/prod-schema.json
```

The file `prod-schema.json` will contain the structured JSON representation of your schema.

### Example 2: Compare a local schema with production

First, capture the schema from your local development database.

**Command:**

```bash
# Assuming local DB is configured via env vars
pg-schema-snapshot capture local-schema.json
```

Then, compare it with the production snapshot you captured earlier.

**Command:**

```bash
pg-schema-snapshot diff prod-schema.json local-schema.json
```

**Output (if differences exist):**

```
Comparing schema snapshots:
  - Source: prod-schema.json
  - Target: local-schema.json

⚠️ Schema differences detected:

[~] MODIFIED: tables.0.columns.1.isNullable from "false" to "true"
[+] ADDED Column: tables.0.columns.3.last_login
[+] ADDED Table: new_features

Found 3 difference(s).
```

### Example 3: Use in a CI/CD Pipeline

You can use `pg-schema-snapshot` in a CI pipeline to prevent unintended schema changes from being deployed.

1.  **Store a "golden" snapshot** (`schema.golden.json`) in your repository that represents the desired production schema.
2.  In your CI job, after a migration runs on a test database, **capture a new snapshot**.
3.  **Run the `diff` command** to compare the new snapshot against the golden one.

A sample CI script step:

```yaml
# .github/workflows/ci.yml
- name: Check for Schema Drift
  run: |
    # Run database migrations on the test DB
    npm run migrate

    # Capture the schema of the test database after migration
    pg-schema-snapshot capture current-schema.json

    # Compare against the golden record. The script will exit with 1 if there are differences.
    # The `||` and `exit 0` part is to prevent the CI job from failing on expected diffs during development.
    # For a strict check, remove the `|| exit 0`.
    pg-schema-snapshot diff schema.golden.json current-schema.json || exit 0
```

If the `diff` command finds changes, it will print them and exit with a non-zero status, causing the CI step to fail and alerting the team.

## License

[MIT](LICENSE)