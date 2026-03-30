import mysql from 'mysql2/promise';
import { BaseClient } from './base-client.js';

/**
 * @file src/db/clients/mysql-client.js
 * @description MySQL-specific database client implementation.
 *
 * This class handles all interactions with a MySQL database, including
 * connection management, schema introspection, and DDL generation. It uses the
 * 'mysql2' library to communicate with the database.
 */
export class MysqlClient extends BaseClient {
  /**
   * Establishes a connection to the MySQL database using a connection pool.
   *
   * @returns {Promise<void>} A promise that resolves when the connection pool is ready.
   * @throws {Error} If the connection fails.
   */
  async connect() {
    if (this.pool) {
      return;
    }
    try {
      // mysql2 pool options are slightly different from pg
      const poolConfig = {
        ...this.config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
      this.pool = mysql.createPool(poolConfig);
      // Test the connection by acquiring a client and immediately releasing it.
      const connection = await this.pool.getConnection();
      connection.release();
    } catch (error) {
      this.pool = null; // Reset pool on failure
      throw new Error(`Failed to connect to MySQL database: ${error.message}`);
    }
  }

  /**
   * Closes the connection pool to the MySQL database.
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
   * Executes a SQL query against the MySQL database.
   *
   * @param {string} sql - The SQL query string to execute.
   * @param {Array<any>} [params=[]] - An array of parameters for prepared statements.
   * @param {object} [client=this.pool] - An optional client to use for the query, defaults to the pool.
   * @returns {Promise<Array<object>>} A promise that resolves with the query result rows.
   * @throws {Error} If the query fails.
   */
  async query(sql, params = [], client = this.pool) {
    if (!client) {
      throw new Error('Database is not connected. Call connect() before querying.');
    }
    try {
      const [rows] = await client.query(sql, params);
      return rows;
    } catch (error) {
      // Enhance error with query details for better debugging
      const errorMessage = `MySQL query failed: ${error.message}\nQuery: ${sql}\nParams: ${JSON.stringify(params)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Introspects the live MySQL database schema and returns it in a standardized format.
   * This method queries `information_schema` to build a comprehensive
   * model of tables, columns, and indexes.
   *
   * @returns {Promise<object>} A promise that resolves with the introspected schema object.
   */
  async introspectSchema() {
    const schema = {};
    const tables = await this._getTables();
    for (const table of tables) {
      const [columns, indexes] = await Promise.all([
        this._getColumns(table.TABLE_NAME),
        this._getIndexes(table.TABLE_NAME),
      ]);
      schema[table.TABLE_NAME] = { columns, indexes };
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
      return `  \`${columnName}\` ${this._columnSpec(col)}`;
    });

    return `CREATE TABLE \`${tableName}\` (\n${columnDefs.join(',\n')}\n);`;
  }

  /**
   * Generates a DDL statement for dropping an existing table.
   *
   * @param {string} tableName - The name of the table to drop.
   * @returns {string} The `DROP TABLE` DDL statement.
   */
  generateDropTableDDL(tableName) {
    return `DROP TABLE \`${tableName}\`;`;
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
    return `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${this._columnSpec(columnDefinition)};`;
  }

  /**
   * Generates a DDL statement for dropping an existing column from a table.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to drop.
   * @returns {string} The `ALTER TABLE ... DROP COLUMN` DDL statement.
   */
  generateDropColumnDDL(tableName, columnName) {
    return `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\`;`;
  }

  /**
   * Generates DDL statements for altering an existing column.
   * MySQL uses `MODIFY COLUMN` which can handle type, nullability, and default changes in one go.
   *
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to alter.
   * @param {object} oldColumn - The current definition of the column.
   * @param {object} newColumn - The desired definition of the column.
   * @returns {Array<string>} An array containing a single `ALTER TABLE ... MODIFY COLUMN` DDL statement.
   */
  generateAlterColumnDDL(tableName, columnName, oldColumn, newColumn) {
    // MySQL's `MODIFY COLUMN` is powerful and can change everything at once.
    const ddl = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${this._columnSpec(newColumn)};`;
    return [ddl];
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
    const columns = indexDefinition.columns.map(c => `\`${c}\``).join(', ');
    if (indexDefinition.primary) {
      // In MySQL, PRIMARY KEY is a special index, often named 'PRIMARY'.
      return `ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (${columns});`;
    }
    const unique = indexDefinition.unique ? 'UNIQUE ' : '';
    return `CREATE ${unique}INDEX \`${indexName}\` ON \`${tableName}\` (${columns});`;
  }

  /**
   * Generates a DDL statement for dropping an existing index or primary key.
   *
   * @param {string} tableName - The name of the table the index belongs to.
   * @param {string} indexName - The name of the index to drop.
   * @param {object} indexDefinition - The definition of the index being dropped.
   * @returns {string} The `DROP INDEX` or `ALTER TABLE ... DROP PRIMARY KEY` DDL statement.
   */
  generateDropIndexDDL(tableName, indexName, indexDefinition) {
    if (indexDefinition.primary) {
      return `ALTER TABLE \`${tableName}\` DROP PRIMARY KEY;`;
    }
    return `DROP INDEX \`${indexName}\` ON \`${tableName}\`;`;
  }

  /**
   * Begins a transaction.
   *
   * @param {object} client - A specific client connection to use for the transaction.
   * @returns {Promise<void>}
   */
  async beginTransaction(client) {
    await this.query('START TRANSACTION', [], client);
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
    return this.pool.getConnection();
  }

  // --- Private Helper Methods ---

  /**
   * Retrieves a list of tables from the current database.
   * @private
   * @returns {Promise<Array<object>>}
   */
  async _getTables() {
    const sql = `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `;
    return this.query(sql);
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
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION;
    `;
    const rows = await this.query(sql, [tableName]);
    const columns = {};
    for (const row of rows) {
      columns[row.COLUMN_NAME] = {
        type: row.COLUMN_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        default: row.COLUMN_DEFAULT,
        autoIncrement: row.EXTRA.toLowerCase().includes('auto_increment'),
      };
    }
    return columns;
  }

  /**
   * Retrieves index definitions for a specific table.
   * @private
   * @param {string} tableName - The name of the table.
   * @returns {Promise<object>} A map of index names to their definitions.
   */
  async _getIndexes(tableName) {
    const sql = `
      SELECT
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX;
    `;
    const rows = await this.query(sql, [tableName]);
    const indexes = {};
    for (const row of rows) {
      if (!indexes[row.INDEX_NAME]) {
        indexes[row.INDEX_NAME] = {
          columns: [],
          unique: row.NON_UNIQUE === 0,
          primary: row.INDEX_NAME === 'PRIMARY',
        };
      }
      indexes[row.INDEX_NAME].columns.push(row.COLUMN_NAME);
    }
    return indexes;
  }

  /**
   * Generates a MySQL-specific column specification string.
   * @private
   * @param {object} col - The column definition.
   * @returns {string} The column specification string for use in DDL.
   */
  _columnSpec(col) {
    let spec = col.type;
    spec += col.nullable ? ' NULL' : ' NOT NULL';
    if (col.default !== null && col.default !== undefined) {
      // In MySQL, string defaults need to be quoted.
      // The introspection gives us unquoted values, so we add them here.
      if (typeof col.default === 'string') {
        spec += ` DEFAULT '${col.default.replace(/'/g, "''")}'`;
      } else {
        spec += ` DEFAULT ${col.default}`;
      }
    } else if (col.nullable && col.default === null) {
      // Explicitly set `DEFAULT NULL` for nullable columns if no other default is provided.
      spec += ' DEFAULT NULL';
    }

    if (col.autoIncrement) {
      spec += ' AUTO_INCREMENT';
    }
    return spec;
  }
}