# pg-logical-streamer

A lightweight, pure JavaScript client for subscribing to PostgreSQL's logical replication stream. It allows Node.js applications to listen for real-time database changes (INSERT, UPDATE, DELETE) without complex setup or native dependencies. Ideal for building event-driven architectures, data pipelines, and real-time analytics dashboards directly from your database.

[![npm version](https://badge.fury.io/js/pg-logical-streamer.svg)](https://badge.fury.io/js/pg-logical-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Pure JavaScript**: No native dependencies or compilation required. Works wherever Node.js runs.
- **Modern API**: Built with modern ES modules, `async/await`, and an `EventEmitter` interface.
- **Rich Event-Driven Model**: Emits discrete events for `insert`, `update`, `delete`, `truncate`, and transaction boundaries (`begin`, `commit`).
- **Robust Connection Handling**: Manages automatic keep-alives and graceful shutdowns.
- **WAL Position Acknowledgment**: Automatically reports the processed Log Sequence Number (LSN) to PostgreSQL, preventing log buildup on the server.
- **Schema-Aware Parsing**: Caches table schemas to provide structured data with column names.
- **Type Deserialization**: Intelligently converts PostgreSQL's text-based data into native JavaScript types (numbers, booleans, dates, JSON).
- **CLI Tool**: Includes `pg-logical-stream-cli` for inspecting publications, slots, and tailing a stream for debugging.

## PostgreSQL Setup

Before using this library, you need to configure your PostgreSQL server for logical replication.

### 1. Configure `postgresql.conf`

Ensure your `postgresql.conf` file has logical replication enabled. This requires a server restart.

```ini
# postgresql.conf
wal_level = logical
```

### 2. Create a Replication User

Create a dedicated user with the `REPLICATION` role.

```sql
CREATE ROLE my_replication_user WITH REPLICATION LOGIN PASSWORD 'your_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO my_replication_user;
ALTER USER my_replication_user WITH REPLICATION;
```

### 3. Create a Publication

A publication is a group of tables whose changes you want to replicate.

```sql
-- Replicate all changes for specific tables
CREATE PUBLICATION my_publication FOR TABLE users, products;

-- Or, replicate all changes for all tables in the database
CREATE PUBLICATION my_publication FOR ALL TABLES;
```

### 4. Create a Replication Slot

A replication slot ensures that the primary server retains the WAL logs needed by the client, even when the client is disconnected.

Use the included CLI to create a slot easily:

```bash
# The CLI will prompt for your password if not set via environment variables
pg-logical-stream-cli slots --create-slot my_slot
```

Or create it manually via SQL:

```sql
-- The 'pgoutput' plugin is the standard logical decoding output plugin.
SELECT pg_create_logical_replication_slot('my_slot', 'pgoutput');
```

## Installation

```bash
npm install pg-logical-streamer
```

## Usage

### API

Instantiate the `PgLogicalStream` client, attach event listeners, and start the stream.

```javascript
import { PgLogicalStream } from 'pg-logical-streamer';

const stream = new PgLogicalStream({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'my_replication_user',
    password: 'your_password',
    database: 'my_database',
  },
  slotName: 'my_slot',
  publicationName: 'my_publication',
});

stream.on('connect', () => {
  console.log('Stream connected.');
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});

stream.on('close', () => {
  console.log('Stream closed.');
});

// Listen for data changes
stream.on('insert', (change) => {
  console.log('INSERT on', `${change.schema}.${change.table}`);
  console.log(change.new);
  // { id: 1, name: 'John Doe', email: 'john.doe@example.com' }
});

stream.on('update', (change) => {
  console.log('UPDATE on', `${change.schema}.${change.table}`);
  console.log('Old data:', change.old);
  console.log('New data:', change.new);
});

stream.on('delete', (change) => {
  console.log('DELETE on', `${change.schema}.${change.table}`);
  console.log('Deleted data:', change.old);
});

// Start the stream
(async () => {
  try {
    await stream.start();
    console.log('Streaming changes...');
  } catch (err) {
    console.error('Failed to start streaming:', err);
  }
})();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await stream.stop();
  process.exit(0);
});
```

### Command-Line Interface (CLI)

The package includes a CLI tool for diagnostics and debugging.

```bash
# List available publications
pg-logical-stream-cli publications -h localhost -U my_replication_user -d my_database

# List logical replication slots
pg-logical-stream-cli slots -h localhost -U my_replication_user

# Tail a replication stream and print all messages as JSON
pg-logical-stream-cli tail --slot my_slot --publication my_publication --json
```

## API Reference

### `new PgLogicalStream(options)`

- `options` `<object>`
  - `connection` `<object>` **Required**. Connection options passed directly to `node-postgres`.
  - `slotName` `<string>` The name of the logical replication slot. **Default:** `'pg_logical_streamer_slot'`.
  - `publicationName` `<string>` The name of the publication to subscribe to. **Default:** `'pg_logical_streamer_pub'`.
  - `startLsn` `<string>` The LSN to start streaming from. **Default:** `'0/0'`.
  - `flushIntervalMs` `<number>` How often to acknowledge the processed LSN with the server. **Default:** `10000`.
  - `keepAliveIntervalMs` `<number>` How often to send a keep-alive message to prevent timeouts. **Default:** `10000`.

### Events

- `event: 'connect'` - Emitted on successful connection.
- `event: 'close'` - Emitted when the connection is closed.
- `event: 'error'` - Emitted on a stream or connection error.
- `event: 'data'` - Emitted for every raw parsed message (`begin`, `commit`, `insert`, etc.).
- `event: 'begin'` - Emitted for a transaction `BEGIN` message.
- `event: 'commit'` - Emitted for a transaction `COMMIT` message.
- `event: 'insert'` - Emitted for an `INSERT` operation. The payload is an object containing `schema`, `table`, and the `new` row data.
- `event: 'update'` - Emitted for an `UPDATE` operation. The payload contains `schema`, `table`, and `new`/`old` row data.
- `event: 'delete'` - Emitted for a `DELETE` operation. The payload contains `schema`, `table`, and the `old` row data.
- `event: 'truncate'` - Emitted for a `TRUNCATE` operation.

### Methods

- `stream.start()`: `async` - Connects to the database and begins streaming. Returns a `Promise` that resolves on success or rejects on failure.
- `stream.stop()`: `async` - Gracefully stops the stream and disconnects. Returns a `Promise` that resolves when fully stopped.
- `stream.typeDeserializer`: `<TypeDeserializer>` - Access the type deserializer instance to register custom parsers.
  - `stream.typeDeserializer.register(typeId, parserFn)`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/my-new-feature`).
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin feature/my-new-feature`).
5. Create a new Pull Request.

## License

[MIT](./LICENSE)