/**
 * @file src/cli/commands/plan.js
 * @description Implements the `plan` command for the schema-sync CLI.
 *
 * This command performs a dry run of the schema synchronization process. It:
 * 1. Loads the application configuration.
 * 2. Parses the desired schema from the specified YAML/JSON file.
 * 3. Connects to the target database and introspects its current schema.
 * 4. Computes the difference between the desired and current schemas.
 * 5. Generates the necessary DDL statements to align the database with the desired schema.
 * 6. Prints the generated DDL to the console without executing it.
 *
 * This allows users to review and verify the changes before applying them.
 */

import { loadConfig } from '../../config/loader.js';
import { parseSchema } from '../../schema/parser.js';
import { createDbClient } from '../../db/client-factory.js';
import { compareSchemas } from '../../diff/comparator.js';
import { generateDDL } from '../../engine/ddl-generator.js';

/**
 * Yargs command configuration for the `plan` command.
 */
export const command = 'plan';
export const describe = 'Generates and shows a migration plan (DDL) without applying it.';

/**
 * Configures the yargs builder for the `plan` command.
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
    .option('color', {
      describe: 'Enable or disable colorized output',
      type: 'boolean',
      default: true,
    });
}

/**
 * The main handler function for the `plan` command.
 * Orchestrates the entire planning process from config loading to DDL output.
 * @param {object} argv - The parsed command-line arguments from yargs.
 */
export async function handler(argv) {
  let dbClient;

  try {
    // 1. Load and validate configuration
    console.log(`- Loading configuration from: ${argv.config}`);
    const config = await loadConfig(argv.config);

    // 2. Parse the desired schema definition file
    console.log(`- Parsing desired schema from: ${config.schemaFile}`);
    const desiredSchema = await parseSchema(config.schemaFile);

    // 3. Connect to the database and introspect the current schema
    console.log(`- Connecting to ${config.db.type} database...`);
    dbClient = createDbClient(config.db);
    await dbClient.connect();
    console.log('- Introspecting current database schema...');
    const currentSchema = await dbClient.introspectSchema();

    // 4. Compute the difference between desired and current schemas
    console.log('- Comparing schemas and computing differences...');
    const diff = compareSchemas(desiredSchema, currentSchema);

    // 5. Generate DDL statements from the computed diff
    console.log('- Generating DDL migration plan...');
    const ddlStatements = generateDDL(diff, dbClient);

    // 6. Display the plan
    console.log('\n----------------- MIGRATION PLAN -----------------');
    if (ddlStatements.length === 0) {
      console.log('\n✅ Your database schema is already up-to-date. No changes are needed.');
    } else {
      console.log('\nThe following DDL statements will be executed to update the schema:');
      const formattedDDL = formatDDL(ddlStatements, argv.color);
      console.log(`\n${formattedDDL}`);
      console.log('\nRun `schema-sync apply` to execute this plan against the database.');
    }
    console.log('--------------------------------------------------\n');

  } catch (error) {
    console.error(`\n❌ Error during planning phase: ${error.message}`);
    // For developers, printing the stack might be useful.
    // In a production CLI, you might hide this behind a --verbose flag.
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
 * Formats an array of DDL statements for display, with optional colorization.
 * @param {string[]} ddlStatements - An array of DDL SQL strings.
 * @param {boolean} useColor - Whether to apply ANSI color codes.
 * @returns {string} A formatted string of DDL statements.
 */
function formatDDL(ddlStatements, useColor) {
  if (!useColor) {
    return ddlStatements.join('\n\n');
  }

  // ANSI color codes
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
    }
    return `${color}${statement}${colors.reset}`;
  });

  return colorizedStatements.join(`\n\n${colors.dim}--------------------------------------------------${colors.reset}\n\n`);
}