/**
 * @file src/engine/plan-executor.js
 * @description Responsible for executing a migration plan against a database.
 *
 * This module takes a database client and an array of DDL statements (the plan)
 * and executes them. It ensures that all statements are run within a single
 * transaction, so that the migration is atomic. If any statement fails, the
 * entire transaction is rolled back, leaving the database in its original state.
 */

import { BaseClient } from '../db/clients/base-client.js';

/**
 * Custom error class for plan execution failures.
 */
class PlanExecutionError extends Error {
  /**
   * @param {string} message The primary error message.
   * @param {object} [options] Additional options.
   * @param {Error} [options.cause] The original error that caused this one.
   * @param {string} [options.failedStatement] The DDL statement that failed.
   */
  constructor(message, { cause, failedStatement } = {}) {
    super(message, { cause });
    this.name = 'PlanExecutionError';
    this.failedStatement = failedStatement;
  }
}

/**
 * Executes a migration plan (an array of DDL statements) against the database
 * within a single transaction.
 *
 * The function acquires a dedicated client connection from the pool, begins a
 * transaction, executes each DDL statement in order, and then commits the
 * transaction. If any statement fails, it immediately rolls back the transaction
 * and re-throws a detailed error. The dedicated client is released back to the
 * pool in all cases (success, failure, or empty plan).
 *
 * @param {BaseClient} dbClient - An instance of a database client (e.g., PostgresClient, MysqlClient).
 * @param {string[]} ddlStatements - An array of DDL SQL strings to execute.
 * @returns {Promise<void>} A promise that resolves when the plan is successfully applied, or rejects on failure.
 * @throws {PlanExecutionError} If any part of the execution fails, including connection acquisition or transaction management.
 */
export async function executePlan(dbClient, ddlStatements) {
  if (!(dbClient instanceof BaseClient)) {
    throw new TypeError('dbClient must be an instance of BaseClient or its subclass.');
  }

  if (!Array.isArray(ddlStatements)) {
    throw new TypeError('ddlStatements must be an array of strings.');
  }

  if (ddlStatements.length === 0) {
    console.log('Plan is empty, no statements to execute.');
    return;
  }

  let transactionClient = null;
  try {
    // 1. Acquire a dedicated client connection for the transaction.
    // This ensures all subsequent commands happen on the same connection.
    transactionClient = await dbClient.getTransactionClient();

    // 2. Begin the transaction.
    await dbClient.beginTransaction(transactionClient);
    console.log('  -> Transaction started.');

    // 3. Execute each DDL statement sequentially.
    for (const [index, statement] of ddlStatements.entries()) {
      if (typeof statement !== 'string' || statement.trim() === '') {
        // Skip empty or invalid statements, but log a warning.
        console.warn(`  -> Skipping empty DDL statement at index ${index}.`);
        continue;
      }

      console.log(`  -> Executing (${index + 1}/${ddlStatements.length}): ${statement.split('\n')[0]}...`);
      try {
        await dbClient.query(statement, [], transactionClient);
      } catch (error) {
        // If a statement fails, wrap the error and re-throw to trigger the rollback.
        throw new PlanExecutionError(
          `Execution failed on statement ${index + 1}`,
          { cause: error, failedStatement: statement }
        );
      }
    }

    // 4. If all statements succeed, commit the transaction.
    await dbClient.commitTransaction(transactionClient);
    console.log('  -> Transaction committed successfully.');

  } catch (error) {
    console.error('  -> An error occurred during plan execution. Rolling back transaction...');

    if (transactionClient) {
      try {
        await dbClient.rollbackTransaction(transactionClient);
        console.log('  -> Transaction rolled back successfully.');
      } catch (rollbackError) {
        // If rollback fails, the situation is critical. The connection might be dead.
        // We log this but still throw the original error.
        console.error(`  -> CRITICAL: Failed to rollback transaction: ${rollbackError.message}`);
      }
    }

    // Re-throw the original or wrapped error to the caller (e.g., the CLI handler).
    if (error instanceof PlanExecutionError) {
      // Enhance the error message for better user feedback.
      const finalMessage = `Migration failed and was rolled back. Error executing DDL:\n` +
                           `Statement: ${error.failedStatement}\n` +
                           `Reason: ${error.cause?.message || 'Unknown reason'}`;
      throw new PlanExecutionError(finalMessage, { cause: error.cause });
    } else {
      // This could be an error from acquiring the client or starting the transaction.
      throw new PlanExecutionError(`An unexpected error occurred: ${error.message}`, { cause: error });
    }

  } finally {
    // 5. Always release the client back to the pool.
    if (transactionClient) {
      // The `release` method is specific to the underlying driver's client object.
      // For both `pg` and `mysql2`, it's called `release()`.
      if (typeof transactionClient.release === 'function') {
        transactionClient.release();
        console.log('  -> Database client released.');
      } else {
        console.warn('  -> Warning: Transaction client does not have a release() method. Connection may be leaked.');
      }
    }
  }
}