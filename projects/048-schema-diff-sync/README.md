# Schema Diff Sync

A declarative, stateful schema synchronization tool for PostgreSQL and MySQL. It computes the difference between a desired schema definition (in a JSON/YAML file) and a live database, then generates and optionally applies the necessary DDL migration scripts to bring the database into the desired state.

It is designed for developers who want to manage their database schema declaratively, similar to Terraform, but for relational databases.

## Features

-   **Declarative Schema**: Define your entire database schema in a single, version-controllable YAML or JSON file.
-   **Multi-Database Support**: Works with both PostgreSQL and MySQL.
-   **Intelligent Diffing**: Automatically detects changes to tables, columns (type, nullability, default), and indexes.
-   **Safe Migrations**: Generates idempotent DDL scripts and provides a `plan` (dry-run) mode to preview changes before applying.
-   **Transactional Applies**: Executes all DDL changes within a single transaction to ensure atomicity. If any step fails, the entire migration is rolled back.
-   **State Tracking**: Maintains a state file to prevent drift and ensure the tool knows the last successfully applied schema state.
-   **CI/CD Friendly**: A powerful CLI makes it easy to integrate schema management into your development and deployment workflows.

## Installation

You can install `schema-diff-sync` globally via npm to use it as a command-line tool in any project.

```bash
npm install -g schema-diff-sync
```

Alternatively, you can clone the repository and install dependencies for development:

```bash
git clone https://github.com/your-username/schema-diff-sync.git
cd schema-diff-sync
npm install
# Use the tool via `npm start --` or by linking the binary
npm link
```

## Usage

The core workflow involves three main components: a configuration file, a schema definition file, and the CLI commands (`plan` and `apply`).

### 1. Configuration File

Create a configuration file (e.g., `db.yml`) to specify your database connection details and the path to your schema definition.

**`db.yml` (PostgreSQL Example)**

```yaml
# Database connection details
db:
  type: "postgres"
  host: "localhost"
  port: 5432
  user: "your_user"
  password: "your_password"
  database: "your_db"

# Path to your declarative schema file (relative to this config file)
schemaFile: "./schema.yml"

# Optional: Path for the state file (defaults to .schema-sync.state.json)
stateFile: "./.schema-sync.state.json"
```

### 2. Schema Definition File

Define your desired database schema in a YAML or JSON file.

**`schema.yml` (PostgreSQL Example)**

```yaml
users:
  columns:
    id:
      type: "serial"
      primary: true
    email:
      type: "varchar(255)"
      nullable: false
      unique: true
    full_name:
      type: "varchar(255)"
      nullable: true
    created_at:
      type: "timestamp with time zone"
      nullable: false
      default: "now()"
  indexes:
    users_pkey:
      columns: ["id"]
      primary: true
    users_email_key:
      columns: ["email"]
      unique: true

posts:
  columns:
    id:
      type: "serial"
      primary: true
    user_id:
      type: "integer"
      nullable: false
    title:
      type: "varchar(255)"
      nullable: false
    content:
      type: "text"
      nullable: true
  indexes:
    posts_pkey:
      columns: ["id"]
      primary: true
    posts_user_id_idx:
      columns: ["user_id"]
```

### 3. CLI Commands

Use the `schema-sync` CLI to manage your schema.

-   **`plan`**: Show a dry-run of the changes required to match the desired schema. No changes are made to the database.

    ```bash
    schema-sync plan --config db.yml
    ```

-   **`apply`**: Generate and execute the migration plan against the database.

    ```bash
    # Show the plan and prompt for confirmation
    schema-sync apply --config db.yml

    # Skip the confirmation prompt (useful for CI/CD)
    schema-sync apply --config db.yml --auto-approve
    ```

## Examples

### Example 1: Initial Schema Creation

Imagine your database is empty and you want to create the `users` table from the schema definition above.

**Command:**

```bash
schema-sync plan --config db.yml
```

**Expected Output:**

```
- Loading configuration from: db.yml
- Parsing desired schema from: /path/to/project/schema.yml
- Connecting to postgres database...
- Introspecting current database schema...
- Comparing schemas and computing differences...
- Generating DDL migration plan...

----------------- MIGRATION PLAN -----------------

The following DDL statements will be executed to update the schema:

CREATE TABLE "users" (
  "id" serial,
  "email" varchar(255) NOT NULL,
  "full_name" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--------------------------------------------------

ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

--------------------------------------------------

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

--------------------------------------------------

Run `schema-sync apply` to execute this plan against the database.
--------------------------------------------------

- Database connection closed.
```

To apply these changes, you would run `schema-sync apply --config db.yml` and confirm.

### Example 2: Adding a Column

Now, let's add a new `status` column to the `users` table in `schema.yml`:

**`schema.yml` (updated)**

```yaml
users:
  columns:
    id:
      type: "serial"
      primary: true
    email:
      type: "varchar(255)"
      nullable: false
      unique: true
    full_name:
      type: "varchar(255)"
      nullable: true
    status: # <-- New column
      type: "varchar(50)"
      nullable: false
      default: "'active'"
    created_at:
      type: "timestamp with time zone"
      nullable: false
      default: "now()"
  # ... indexes remain the same
```

**Command:**

```bash
schema-sync plan --config db.yml
```

**Expected Output:**

```
- Loading configuration from: db.yml
...
----------------- MIGRATION PLAN -----------------

The following DDL statements will be executed to update the schema:

ALTER TABLE "users" ADD COLUMN "status" varchar(50) NOT NULL DEFAULT 'active';

--------------------------------------------------

Run `schema-sync apply` to execute this plan against the database.
--------------------------------------------------

- Database connection closed.
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/my-new-feature`).
3.  Commit your changes (`git commit -am 'Add some feature'`).
4.  Push to the branch (`git push origin feature/my-new-feature`).
5.  Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.