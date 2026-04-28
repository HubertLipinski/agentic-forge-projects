/**
 * @fileoverview The command-line interface (CLI) for the JSDoc-to-Zod generator.
 * This file uses Yargs to parse command-line arguments, handles file and directory
 * inputs with glob support, and calls the core programmatic API to perform the
 * schema generation.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generate } from './api.js';
import TypeResolver from './type-resolver.js';

/**
 * The main entry point for the CLI application.
 * It parses arguments, finds files, processes them, and writes the output.
 *
 * @param {string[]} argv - The command-line arguments, typically from `process.argv`.
 * @returns {Promise<void>} A promise that resolves when the CLI has finished, or rejects on error.
 */
export async function run(argv) {
	const y = yargs(hideBin(argv));

	const args = await y
		.usage('Usage: $0 <input...> [options]')
		.positional('input', {
			describe: 'One or more file or glob patterns to process.',
			type: 'string',
		})
		.demandCommand(1, 'You must provide at least one input file or glob pattern.')
		.option('output', {
			alias: 'o',
			describe: 'The output file path for the generated Zod schemas. If not provided, prints to stdout.',
			type: 'string',
			normalize: true,
		})
		.option('recursive', {
			alias: 'r',
			describe: 'Process files in subdirectories. This is often implicit with glob patterns like `**/*.js`.',
			type: 'boolean',
			default: false,
		})
		.option('name', {
			alias: 'n',
			describe: 'The name for the combined schema file. Used when multiple input files generate a single output.',
			type: 'string',
			default: 'schemas.js',
		})
		.help('h')
		.alias('h', 'help')
		.alias('v', 'version')
		.epilogue('For more information, visit the project repository.')
		.strict()
		.parserConfiguration({ 'greedy-arrays': false })
		.argv;

	try {
		// 1. Find all files matching the input patterns.
		const filePaths = await glob(args.input, {
			nodir: true, // Exclude directories from the results
			ignore: ['node_modules/**', '**/test/**', '**/tests/**'],
		});

		if (filePaths.length === 0) {
			console.warn('No matching files found for the given input patterns.');
			return;
		}

		console.log(`Found ${filePaths.length} file(s) to process...`);

		// 2. Process all files to build a complete type context.
		const typeResolver = new TypeResolver();
		const allSchemas = [];
		let hasGeneratedContent = false;

		for (const filePath of filePaths) {
			try {
				const sourceCode = await fs.readFile(filePath, 'utf8');
				// The `generate` function will find and register all `@typedef`s first,
				// then generate schemas for all JSDoc blocks in the file.
				// By passing the same `typeResolver` instance, we build a complete
				// picture of all types across all files before generating the final output.
				const result = await generate(sourceCode, {
					filePath,
					typeResolver,
				});

				if (result.zodSchema) {
					// We collect individual schemas to combine them later.
					allSchemas.push(...result.schemas);
					hasGeneratedContent = true;
				}
			} catch (readError) {
				console.error(`Error reading or processing file ${filePath}:`, readError.message);
				// Continue to the next file
			}
		}

		if (!hasGeneratedContent) {
			console.log('Processing complete. No JSDoc comments found that could be converted to Zod schemas.');
			return;
		}

		// 3. Generate the final combined file content.
		// This function is imported from the generator and adds the Zod import.
		const { generateZodFileContent } = await import('./generator/zod-generator.js');
		const finalContent = generateZodFileContent(allSchemas);

		// 4. Write the output to a file or stdout.
		if (args.output) {
			const outputDir = path.dirname(args.output);
			try {
				await fs.mkdir(outputDir, { recursive: true });
				await fs.writeFile(args.output, finalContent, 'utf8');
				console.log(`✅ Zod schemas successfully generated at: ${args.output}`);
			} catch (writeError) {
				console.error(`Error writing to output file ${args.output}:`, writeError.message);
				process.exit(1);
			}
		} else {
			// If no output file is specified, print to the console.
			process.stdout.write(finalContent);
		}
	} catch (error) {
		console.error('\n❌ An unexpected error occurred:');
		console.error(error.message);
		// For developers, you might want to see the stack trace.
		// console.error(error.stack);
		process.exit(1);
	}
}