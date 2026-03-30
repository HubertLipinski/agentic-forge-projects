/**
 * @file src/cli/commands/apply.js
 * @description Implements the `apply` command for the schema-sync CLI.
 *
 * This command orchestrates the full schema synchronization process. It:
 * 1. Generates a migration plan by comparing the desired schema with the live database.
 * 2. Displays the plan to the user for review.
 * 3. Prompts the user for confirmation before proceeding (unless `--auto-approve` is used).
 * 4. Executes the DDL statements against the database within a transaction.
 * 5. On success, it updates the state file with the new schema hash to prevent drift.
 * 6. On failure, it rolls back the transaction, leaving the database untouched.
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig } from '../../config/loader.js';
import { parseSchema } from '../../schema/parser.js';
import { createDbClient } from '../../db/client-factory.js';
import { compareSchemas } from '../../diff/comparator.js';
import { generateDDL } from '../../engine/ddl-generator.js';
import { executePlan } from '../../engine/plan-executor.js';
import { loadState, saveState, generateSchemaHash } from '../../state/manager.js';

/**
 * Yargs command configuration for the `apply` command.
 */
export const command = 'apply';
export const describe = 'Computes and applies a migration plan to the database.';

/**
 * Configures the yargs builder for the `apply` command.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export function builder(yargs) {
  return yargs
    .option('config', {
      alias: 'c',
      describe: 'Path to the configuration file (e.g., db.yml)',
      type: 'string',
      demandOption: true,
    })
    .option('auto-approve', {
      alias: 'y',
      describe: 'Automatically approve and apply the plan without prompting for confirmation.',
      type: 'boolean',
      default: false,
    })
    .option('dry-run', {
      describe: 'Show the plan and exit without applying changes. Equivalent to the `plan` command.',
      type: 'boolean',
      default: false,
    })
    .option('color', {
      describe: 'Enable or disable colorized output.',
      type: 'boolean',
      default: true,
    });
}

/**
 * The main handler function for the `apply` command.
 * Orchestrates the entire synchronization process from planning to execution and state management.
 * @param {object} argv - The parsed command-line arguments from yargs.
 */
export async function handler(argv) {
  let dbClient;
  const startTime = Date.now();

  try {
    // --- 1. Planning Phase ---
    console.log(`- Loading configuration from: ${argv.config}`);
    const config = await loadConfig(argv.config);

    console.log(`- Parsing desired schema from: ${config.schemaFile}`);
    const desiredSchema = await parseSchema(config.schemaFile);

    console.log(`- Loading state file from: ${config.stateFile}`);
    const currentState = await loadState(config.stateFile);
    const newSchemaHash = generateSchemaHash(desiredSchema);

    if (currentState.schemaHash === newSchemaHash) {
      console.log('\n✅ Schema is already in the desired state. No changes to apply.');
      return;
    }

    console.log(`- Connecting to ${config.db.type} database...`);
    dbClient = createDbClient(config.db);
    await dbClient.connect();

    console.log('- Introspecting current database schema...');
    const currentSchema = await dbClient.introspectSchema();

    console.log('- Comparing schemas and computing differences...');
    const diff = compareSchemas(desiredSchema, currentSchema);

    console.log('- Generating DDL migration plan...');
    const ddlStatements = generateDDL(diff, dbClient);

    // --- 2. Plan Review Phase ---
    displayPlan(ddlStatements, argv.color);

    if (ddlStatements.length === 0) {
      console.log('\n✅ Your database schema is already up-to-date. No changes are needed.');
      console.log('- Updating state file to reflect current schema hash...');
      await saveState(config.stateFile, { schemaHash: newSchemaHash });
      console.log('State file updated successfully.');
      return;
    }

    if (argv.dryRun) {
      console.log('\n--dry-run enabled. Exiting without applying changes.');
      return;
    }

    // --- 3. Confirmation Phase ---
    const approved = argv.autoApprove || await confirmApply();
    if (!approved) {
      console.log('\nApply operation cancelled by user.');
      return;
    }

    // --- 4. Execution Phase ---
    console.log('\n- Applying migration plan...');
    await executePlan(dbClient, ddlStatements);
    console.log('✅ Migration plan applied successfully.');

    // --- 5. State Update Phase ---
    console.log(`- Updating state file: ${config.stateFile}`);
    await saveState(config.stateFile, { schemaHash: newSchemaHash });
    console.log('✅ State file updated successfully.');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Sync complete in ${duration}s.`);

  } catch (error) {
    console.error(`\n❌ Error during apply phase: ${error.message}`);
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (dbClient) {
      await dbClient.disconnect();
      console.log('- Database connection closed.');
    }
  }
}

/**
 * Displays the generated DDL statements to the console.
 * @param {string[]} ddlStatements - An array of DDL SQL strings.
 * @param {boolean} useColor - Whether to apply ANSI color codes.
 */
function displayPlan(ddlStatements, useColor) {
  console.log('\n----------------- MIGRATION PLAN -----------------');
  if (ddlStatements.length > 0) {
    console.log('The following DDL statements will be executed to update the schema:');
    const formattedDDL = formatDDL(ddlStatements, useColor);
    console.log(`\n${formattedDDL}`);
  }
  console.log('--------------------------------------------------');
}

/**
 * Prompts the user for confirmation to apply the migration plan.
 * @returns {Promise<boolean>} A promise that resolves to true if the user confirms, false otherwise.
 */
async function confirmApply() {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('\nDo you want to apply this plan? (yes/no): ');
    return answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Formats an array of DDL statements for display, with optional colorization.
 * @param {string[]} ddlStatements - An array of DDL SQL strings.
 * @param {boolean} useColor - Whether to apply ANSI color codes.
 * @returns {string} A formatted string of DDL statements.
 */
function formatDDL(ddlStatements, useColor) {
  if (!useColor) {
    return ddlStatements.join('\n\n');
  }

  const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    dim: '\x1b[2m',
  };

  const colorizedStatements = ddlStatements.map(statement => {
    let color = colors.yellow; // Default for ALTER
    if (statement.startsWith('CREATE')) {
      color = colors.green;
    } else if (statement.startsWith('DROP')) {
      color = colors.red;
    } else if (statement.startsWith('ALTER')) {
      color = colors.cyan;
    }
    return `${color}${statement}${colors.reset}`;
  });

  return colorizedStatements.join(`\n\n${colors.dim}--------------------------------------------------${colors.reset}\n\n`);
}