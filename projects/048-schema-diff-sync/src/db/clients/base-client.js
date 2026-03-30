/**
 * @file src/db/clients/base-client.js
 * @description Abstract base class defining the interface for database-specific clients.
 *
 * This class establishes a contract that all database clients (e.g., PostgreSQL, MySQL)
 * must follow. It ensures that the core application logic can interact with any
 * database driver through a consistent, well-defined API.
 *
 * Subclasses are expected to implement all methods defined here. Calling a method
 * on the base class itself will result in a `NotImplementedError`.
 */

/**
 * Custom error class for methods that must be implemented by subclasses.
 */
class NotImplementedError extends Error {
  /**
   * @param {string} methodName The name of the method that was not implemented.
   */
  constructor(methodName) {
    super(`Method '${methodName}' must be implemented by a subclass.`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Defines the abstract interface for a database client.
 *
 * @class BaseClient
 * @abstract
 */
export class BaseClient {
  /**
   * @type {object} The database connection configuration.
   */
  config;

  /**
   * @type {object | null} The active database connection pool or client instance.
   */
  pool = null;

  /**
   * Creates an instance of BaseClient.
   * This constructor should be called by subclasses.
   *
   * @param {object} connectionConfig - The database connection details.
   * @throws {Error} If instantiated directly.
   */
  constructor(connectionConfig) {
    if (this.constructor === BaseClient) {
      throw new Error("Abstract class 'BaseClient' cannot be instantiated directly.");
    }
    this.config = connectionConfig;
  }

  /**
   * Establishes a connection to the database.
   * Subclasses must implement this to create and store a connection pool/client.
   *
   * @abstract
   * @returns {Promise<void>} A promise that resolves when the connection is established.
   */
  async connect() {
    throw new NotImplementedError('connect');
  }

  /**
   * Closes the connection to the database.
   * Subclasses must implement this to gracefully close the connection pool/client.
   *
   * @abstract
   * @returns {Promise<void>} A promise that resolves when the connection is closed.
   */
  async disconnect() {
    throw new NotImplementedError('disconnect');
  }

  /**
   * Executes a SQL query.
   *
   * @abstract
   * @param {string} sql - The SQL query string to execute.
   * @param {Array<any>} [params=[]] - An array of parameters for prepared statements.
   * @returns {Promise<object>} A promise that resolves with the query result.
   * The result format may vary by driver (e.g., `{ rows: [...] }` for pg).
   */
  async query(sql, params = []) {
    throw new NotImplementedError('query');
  }

  /**
   * Introspects the live database and returns its schema in a standardized format.
   *
   * The standardized format should be an object where keys are table names.
   * Each table object should contain `columns` and `indexes`.
   * Example:
   * {
   *   'users': {
   *     columns: {
   *       'id': { type: 'integer', nullable: false, default: "nextval('users_id_seq'::regclass)" },
   *       'email': { type: 'character varying(255)', nullable: false, default: null }
   *     },
   *     indexes: {
   *       'users_pkey': { columns: ['id'], unique: true },
   *       'users_email_key': { columns: ['email'], unique: true }
   *     }
   *   }
   * }
   *
   * @abstract
   * @returns {Promise<object>} A promise that resolves with the introspected schema.
   */
  async introspectSchema() {
    throw new NotImplementedError('introspectSchema');
  }

  /**
   * Generates a DDL statement for creating a new table.
   *
   * @abstract
   * @param {string} tableName - The name of the table to create.
   * @param {object} tableDefinition - The definition of the table, including columns and constraints.
   * @returns {string} The `CREATE TABLE` DDL statement.
   */
  generateCreateTableDDL(tableName, tableDefinition) {
    throw new NotImplementedError('generateCreateTableDDL');
  }

  /**
   * Generates a DDL statement for dropping an existing table.
   *
   * @abstract
   * @param {string} tableName - The name of the table to drop.
   * @returns {string} The `DROP TABLE` DDL statement.
   */
  generateDropTableDDL(tableName) {
    throw new NotImplementedError('generateDropTableDDL');
  }

  /**
   * Generates a DDL statement for adding a new column to a table.
   *
   * @abstract
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to add.
   * @param {object} columnDefinition - The definition of the new column.
   * @returns {string} The `ALTER TABLE ... ADD COLUMN` DDL statement.
   */
  generateAddColumnDDL(tableName, columnName, columnDefinition) {
    throw new NotImplementedError('generateAddColumnDDL');
  }

  /**
   * Generates a DDL statement for dropping an existing column from a table.
   *
   * @abstract
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to drop.
   * @returns {string} The `ALTER TABLE ... DROP COLUMN` DDL statement.
   */
  generateDropColumnDDL(tableName, columnName) {
    throw new NotImplementedError('generateDropColumnDDL');
  }

  /**
   * Generates a DDL statement for altering an existing column.
   * This can include changes to type, nullability, or default value.
   *
   * @abstract
   * @param {string} tableName - The name of the table.
   * @param {string} columnName - The name of the column to alter.
   * @param {object} oldColumn - The current definition of the column.
   * @param {object} newColumn - The desired definition of the column.
   * @returns {Array<string>} An array of DDL statements to alter the column.
   *                          (Some databases require multiple statements for one logical change).
   */
  generateAlterColumnDDL(tableName, columnName, oldColumn, newColumn) {
    throw new NotImplementedError('generateAlterColumnDDL');
  }

  /**
   * Generates a DDL statement for adding a new index to a table.
   *
   * @abstract
   * @param {string} tableName - The name of the table.
   * @param {string} indexName - The name of the index to create.
   * @param {object} indexDefinition - The definition of the index (columns, uniqueness).
   * @returns {string} The `CREATE INDEX` DDL statement.
   */
  generateAddIndexDDL(tableName, indexName, indexDefinition) {
    throw new NotImplementedError('generateAddIndexDDL');
  }

  /**
   * Generates a DDL statement for dropping an existing index.
   *
   * @abstract
   * @param {string} tableName - The name of the table the index belongs to.
   * @param {string} indexName - The name of the index to drop.
   * @returns {string} The `DROP INDEX` DDL statement.
   */
  generateDropIndexDDL(tableName, indexName) {
    throw new NotImplementedError('generateDropIndexDDL');
  }

  /**
   * Begins a transaction.
   *
   * @abstract
   * @param {object} [client] - An optional specific client connection to use for the transaction.
   * @returns {Promise<void>}
   */
  async beginTransaction(client) {
    throw new NotImplementedError('beginTransaction');
  }

  /**
   * Commits the current transaction.
   *
   * @abstract
   * @param {object} [client] - The specific client connection used for the transaction.
   * @returns {Promise<void>}
   */
  async commitTransaction(client) {
    throw new NotImplementedError('commitTransaction');
  }

  /**
   * Rolls back the current transaction.
   *
   * @abstract
   * @param {object} [client] - The specific client connection used for the transaction.
   * @returns {Promise<void>}
   */
  async rollbackTransaction(client) {
    throw new NotImplementedError('rollbackTransaction');
  }

  /**
   * Acquires a single client connection from the pool for transactional operations.
   *
   * @abstract
   * @returns {Promise<object>} A promise that resolves with a single client connection object.
   */
  async getTransactionClient() {
    throw new NotImplementedError('getTransactionClient');
  }
}