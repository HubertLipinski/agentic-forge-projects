import { Pool } from 'pg';
import { BaseClient } from './base-client.js';

/**
 * @file src/db/clients/postgres-client.js
 * @description PostgreSQL-specific database client implementation.
 *
 * This class handles all interactions with a PostgreSQL database, including
 * connection management, schema introspection, and DDL generation. It uses the
 * 'pg' library to communicate with the database.
 */
export class PostgresClient extends BaseClient {
  /**
   * Establishes a connection to the PostgreSQL database using a connection pool.
   *
   * @returns {Promise<void>} A promise that resolves when the connection pool is ready.
   * @throws {Error} If the connection fails.
   */
  async connect() {
    if (this.pool) {
      return;
    }
    try {
      this.pool = new Pool(this.config);
      // Test the connection by acquiring a client and immediately releasing it.
      const client = await this.pool.connect();
      client.release();
    } catch (error) {
      this.pool = null; // Reset pool on failure
      throw new Error(`Failed to connect to PostgreSQL database: ${error.message}`);
    }
  }

  /**
   * Closes the connection pool to the PostgreSQL database.
   *
   * @returns {Promise<void>} A promise that resolves when the pool has been closed.
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Executes a SQL query against the PostgreSQL database.
   *
   * @param {string} sql - The SQL query string to execute.
   * @param {Array<any>} [params=[]] - An array of parameters for prepared statements.
   * @param {object} [client=this.pool] - An optional client to use for the query, defaults to the pool.
   * @returns {Promise<object>} A promise that resolves with the query result from the 'pg' driver.
   * @throws {Error} If the query fails.
   */
  async query(sql, params = [], client = this.pool) {
    if (!client) {
      throw new Error('Database is not connected. Call connect() before querying.');
    }
    try {
      return await client.query(sql, params);
    } catch (error) {
      // Enhance error with query details for better debugging
      const errorMessage = `PostgreSQL query failed: ${error.message}\nQuery: ${sql}\nParams: ${JSON.stringify(params)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Introspects the live PostgreSQL database schema and returns it in a standardized format.
   * This method queries `information_schema` and `pg_catalog` to build a comprehensive
   * model of tables, columns, and indexes.
   *
   * @returns {Promise<object>} A promise that resolves with the introspected schema object.
   */
  async introspectSchema() {
    const schema = {};
    const tables = await this._getTables();
    for (const table of tables) {
      const [columns, indexes] = await Promise.all([
        this._getColumns(table.table_name),
        this._getIndexes(table.table_name),
      ]);
      schema[table.table_name] = { columns, indexes };
    }
    return schema;
  }

  /**
   * Generates a DDL statement for creating a new table.
   *
   * @param {string} tableName - The name of the table to create.
   * @param {object} tableDefinition - The definition of the table, including columns.
   * @returns {string} The `CREATE TABLE` DDL statement.
   */
  generateCreateTableDDL(tableName, tableDefinition) {
    const columnDefs = Object.entries(tableDefinition.columns).map(([columnName, col]) => {
      return `  "${columnName}" ${this._columnSpec(col)}`;
    });

    // Note: Primary keys are often defined via indexes/constraints, but can be inline.
    // This implementation assumes indexes/constraints handle PKs.
    return `CREATE TABLE "${tableName}" (\n${columnDefs.join(',\n')}\n);`;
  }

  /**
   * Generates a DDL statement for dropping an existing table.
   *
   * @param {string} tableName - The name of the table to drop.
   * @returns {string} The `DROP TABLE` DDL statement.
   */
  generateDropTableDDL(tableName) {
    return `DROP TABLE "${tableName}";`;
  }

  /**
   * Generates a DDL statement for adding a new column to a table.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to add.
   * @param {object} columnDefinition - The definition of the new column.
   * @returns {string} The `ALTER TABLE ... ADD COLUMN` DDL statement.
   */
  generateAddColumnDDL(tableName, columnName, columnDefinition) {
    return `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${this._columnSpec(columnDefinition)};`;
  }

  /**
   * Generates a DDL statement for dropping an existing column from a table.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to drop.
   * @returns {string} The `ALTER TABLE ... DROP COLUMN` DDL statement.
   */
  generateDropColumnDDL(tableName, columnName) {
    return `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}";`;
  }

  /**
   * Generates DDL statements for altering an existing column.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to alter.
   * @param {object} oldColumn - The current definition of the column.
   * @param {object} newColumn - The desired definition of the column.
   * @returns {Array<string>} An array of DDL statements to alter the column.
   */
  generateAlterColumnDDL(tableName, columnName, oldColumn, newColumn) {
    const ddl = [];
    const quotedTableName = `"${tableName}"`;
    const quotedColumnName = `"${columnName}"`;

    // Type change
    if (oldColumn.type !== newColumn.type) {
      // `USING` clause might be needed for some type conversions.
      // For simplicity, we generate a direct cast. Users may need to intervene for complex cases.
      ddl.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${quotedColumnName} TYPE ${newColumn.type} USING ${quotedColumnName}::${newColumn.type};`);
    }

    // Nullability change
    if (oldColumn.nullable !== newColumn.nullable) {
      const action = newColumn.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
      ddl.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${quotedColumnName} ${action};`);
    }

    // Default value change
    if (oldColumn.default !== newColumn.default) {
      if (newColumn.default === null) {
        ddl.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${quotedColumnName} DROP DEFAULT;`);
      } else {
        ddl.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${quotedColumnName} SET DEFAULT ${newColumn.default};`);
      }
    }

    return ddl;
  }

  /**
   * Generates a DDL statement for adding a new index or primary key.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} indexName - The name of the index to create.
   * @param {object} indexDefinition - The definition of the index.
   * @returns {string} The `CREATE INDEX` or `ALTER TABLE ... ADD CONSTRAINT` DDL statement.
   */
  generateAddIndexDDL(tableName, indexName, indexDefinition) {
    const columns = indexDefinition.columns.map(c => `"${c}"`).join(', ');
    if (indexDefinition.primary) {
      return `ALTER TABLE "${tableName}" ADD CONSTRAINT "${indexName}" PRIMARY KEY (${columns});`;
    }
    const unique = indexDefinition.unique ? 'UNIQUE ' : '';
    return `CREATE ${unique}INDEX "${indexName}" ON "${tableName}" (${columns});`;
  }

  /**
   * Generates a DDL statement for dropping an existing index or primary key.
   *
   * @param {string} tableName - The name of the table the index belongs to.
   * @param {string} indexName - The name of the index to drop.
   * @param {object} indexDefinition - The definition of the index being dropped.
   * @returns {string} The `DROP INDEX` or `ALTER TABLE ... DROP CONSTRAINT` DDL statement.
   */
  generateDropIndexDDL(tableName, indexName, indexDefinition) {
    if (indexDefinition.primary) {
      return `ALTER TABLE "${tableName}" DROP CONSTRAINT "${indexName}";`;
    }
    return `DROP INDEX "${indexName}";`;
  }

  /**
   * Begins a transaction.
   *
   * @param {object} client - A specific client connection to use for the transaction.
   * @returns {Promise<void>}
   */
  async beginTransaction(client) {
    await this.query('BEGIN', [], client);
  }

  /**
   * Commits the current transaction.
   *
   * @param {object} client - The specific client connection used for the transaction.
   * @returns {Promise<void>}
   */
  async commitTransaction(client) {
    await this.query('COMMIT', [], client);
  }

  /**
   * Rolls back the current transaction.
   *
   * @param {object} client - The specific client connection used for the transaction.
   * @returns {Promise<void>}
   */
  async rollbackTransaction(client) {
    await this.query('ROLLBACK', [], client);
  }

  /**
   * Acquires a single client connection from the pool for transactional operations.
   *
   * @returns {Promise<object>} A promise that resolves with a single client connection object.
   */
  async getTransactionClient() {
    if (!this.pool) {
      throw new Error('Database is not connected. Call connect() before getting a transaction client.');
    }
    return this.pool.connect();
  }

  // --- Private Helper Methods ---

  /**
   * Retrieves a list of tables from the public schema.
   * @private
   * @returns {Promise<Array<object>>}
   */
  async _getTables() {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const result = await this.query(sql);
    return result.rows;
  }

  /**
   * Retrieves column definitions for a specific table.
   * @private
   * @param {string} tableName - The name of the table.
   * @returns {Promise<object>} A map of column names to their definitions.
   */
  async _getColumns(tableName) {
    const sql = `
      SELECT
        column_name,
        udt_name AS data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const result = await this.query(sql, [tableName]);
    const columns = {};
    for (const row of result.rows) {
      columns[row.column_name] = {
        type: this._formatDataType(row),
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
      };
    }
    return columns;
  }

  /**
   * Retrieves index and primary key definitions for a specific table.
   * @private
   * @param {string} tableName - The name of the table.
   * @returns {Promise<object>} A map of index names to their definitions.
   */
  async _getIndexes(tableName) {
    const sql = `
      SELECT
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary
      FROM
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a,
        pg_namespace n
      WHERE
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND n.oid = t.relnamespace
        AND n.nspname = 'public'
        AND t.relname = $1
      ORDER BY
        i.relname,
        a.attnum;
    `;
    const result = await this.query(sql, [tableName]);
    const indexes = {};
    for (const row of result.rows) {
      if (!indexes[row.index_name]) {
        indexes[row.index_name] = {
          columns: [],
          unique: row.is_unique,
          primary: row.is_primary,
        };
      }
      indexes[row.index_name].columns.push(row.column_name);
    }
    return indexes;
  }

  /**
   * Formats the data type from information_schema parts into a standard string.
   * @private
   * @param {object} col - The column row from information_schema.
   * @returns {string} The formatted data type string (e.g., 'varchar(255)').
   */
  _formatDataType(col) {
    let type = col.data_type;
    if (type === 'varchar' || type === 'character varying') {
      return `character varying(${col.character_maximum_length})`;
    }
    if (type === 'char' || type === 'character') {
      return `character(${col.character_maximum_length})`;
    }
    if (type === 'numeric' || type === 'decimal') {
      if (col.numeric_precision !== null && col.numeric_scale !== null) {
        return `numeric(${col.numeric_precision}, ${col.numeric_scale})`;
      }
      if (col.numeric_precision !== null) {
        return `numeric(${col.numeric_precision})`;
      }
      return 'numeric';
    }
    // Handle array types like _int4, _text
    if (type.startsWith('_')) {
      return `${type.substring(1)}[]`;
    }
    return type;
  }

  /**
   * Generates the full SQL specification for a column definition.
   * @private
   * @param {object} col - The column definition object.
   * @returns {string} The SQL snippet for a column in a CREATE/ALTER TABLE statement.
   */
  _columnSpec(col) {
    let spec = col.type;
    if (col.nullable === false) {
      spec += ' NOT NULL';
    }
    if (col.default !== undefined && col.default !== null) {
      spec += ` DEFAULT ${col.default}`;
    }
    return spec;
  }
}