import { Command, Option } from 'commander';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from './core/graph-builder.js';
import { generateReport } from './analysis/report-generator.js';
import { exportAsJson } from './exporters/json-exporter.js';
import { exportAsDot } from './exporters/dot-exporter.js';
import { exportAsMermaid } from './exporters/mermaid-exporter.js';
import { OUTPUT_FORMATS, VALID_OUTPUT_FORMATS, DEFAULT_EXCLUDE_PATTERNS } from './constants.js';

/**
 * @fileoverview
 * The main entry point for the Markdown Graph Builder CLI. This module uses the
 * 'commander' library to define the CLI's commands, arguments, and options. It
 * orchestrates the core logic of the application by calling the graph builder,
 * analysis, and exporter modules based on user input.
 */

/**
 * Loads the project's package.json to retrieve version and description information.
 * This is a robust way to keep the CLI's metadata in sync with the project's manifest.
 * @returns {Promise<{version: string, description: string}>}
 * @private
 */
async function getPackageInfo() {
  try {
    const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const { version, description } = JSON.parse(packageJsonContent);
    return { version, description };
  } catch (error) {
    console.warn('Could not read package.json for version info. Using defaults.');
    return { version: '1.0.0', description: 'A CLI tool to build and analyze a graph of Markdown files.' };
  }
}

/**
 * The main asynchronous function that sets up and executes the CLI.
 * It defines the command structure, parses arguments, and runs the
 * appropriate logic.
 */
export async function main() {
  const program = new Command();
  const { version, description } = await getPackageInfo();

  program
    .name('md-graph')
    .version(version)
    .description(description)
    .argument('<directory>', 'The source directory to scan for Markdown files.')
    .option('-o, --output <file>', 'The file path to write the output to. If not specified, prints to stdout.')
    .addOption(
      new Option('-f, --format <format>', 'The output format.')
        .choices(VALID_OUTPUT_FORMATS)
        .default(OUTPUT_FORMATS.REPORT)
    )
    .option('--exclude <patterns...>', 'Glob patterns to exclude from the scan.', DEFAULT_EXCLUDE_PATTERNS)
    .option('--pretty', 'Format the JSON or DOT output for readability.', false)
    .action(run);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Commander's built-in error handling is usually sufficient,
    // but this catches unexpected errors during parsing or action execution.
    console.error(`\x1b[31m[ERROR]\x1b[0m ${error.message}`);
    process.exit(1);
  }
}

/**
 * The core action handler for the CLI command.
 * It takes the parsed arguments and options, builds the graph,
 * generates the requested output, and writes it to the specified
 * destination (file or stdout).
 *
 * @param {string} directory - The source directory provided by the user.
 * @param {object} options - The options object from commander.
 * @param {string} [options.output] - The output file path.
 * @param {string} options.format - The output format.
 * @param {string[]} options.exclude - Glob patterns for exclusion.
 * @param {boolean} options.pretty - Flag for pretty-printing output.
 */
async function run(directory, options) {
  try {
    const projectRoot = path.resolve(process.cwd(), directory);

    // 1. Build the graph
    console.log(`\x1b[34m[INFO]\x1b[0m Scanning directory: ${projectRoot}`);
    const graph = await buildGraph({
      projectRoot,
      scannerOptions: {
        exclude: options.exclude,
      },
    });
    console.log(`\x1b[32m[SUCCESS]\x1b[0m Graph built with ${graph.order} nodes and ${graph.size} edges.`);

    // 2. Generate the output based on the specified format
    let outputContent = '';
    console.log(`\x1b[34m[INFO]\x1b[0m Generating output in '${options.format}' format...`);

    switch (options.format) {
      case OUTPUT_FORMATS.REPORT: {
        const report = await generateReport(graph);
        outputContent = JSON.stringify(report, null, options.pretty ? 2 : 0);
        break;
      }
      case OUTPUT_FORMATS.JSON: {
        outputContent = await exportAsJson(graph, { pretty: options.pretty });
        break;
      }
      case OUTPUT_FORMATS.DOT: {
        // The 'pretty' option for DOT is not standard, but we can use it as a hint
        // for potential future formatting. For now, it doesn't affect the output.
        outputContent = await exportAsDot(graph);
        break;
      }
      case OUTPUT_FORMATS.MERMAID: {
        outputContent = await exportAsMermaid(graph);
        break;
      }
      default:
        // This case should be unreachable due to commander's `choices` validation.
        throw new Error(`Unsupported format: ${options.format}`);
    }

    // 3. Write the output to a file or stdout
    if (options.output) {
      const outputPath = path.resolve(process.cwd(), options.output);
      await fs.writeFile(outputPath, outputContent, 'utf-8');
      console.log(`\x1b[32m[SUCCESS]\x1b[0m Output successfully written to: ${outputPath}`);
    } else {
      // Print to standard output if no file is specified.
      process.stdout.write(outputContent + '\n');
    }
  } catch (error) {
    console.error(`\x1b[31m[FATAL]\x1b[0m An error occurred during execution: ${error.message}`);
    // For debugging, one might want to log the stack trace.
    // console.error(error.stack);
    process.exit(1);
  }
}