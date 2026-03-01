/**
 * @file src/cli.js
 * @description Defines the command-line interface using `yargs` for the JSDoc-to-Zod generator.
 * This module handles file/glob inputs, output options, and orchestrates the file processing
 * and result output for the CLI tool.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { glob } from 'glob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import kleur from 'kleur';
import { processFile } from './processor.js';
import { fileURLToPath } from 'node:url';

// Dynamically import package.json to get version and description
const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

/**
 * Main CLI execution function.
 * It sets up yargs, parses arguments, and runs the generation process.
 *
 * @param {string[]} argv - Command line arguments, typically from `process.argv`.
 */
export async function run(argv) {
  const y = yargs(hideBin(argv));

  y.scriptName('jsdoc-to-zod')
    .usage('$0 <files...>')
    .command(
      '$0 <files...>',
      'Generates Zod schemas from JSDoc annotations in specified files or glob patterns.',
      (yargs) => {
        return yargs
          .positional('files', {
            describe: 'One or more files or glob patterns to process',
            type: 'string',
          })
          .option('output', {
            alias: 'o',
            describe: 'Output directory for generated schema files. If not specified, prints to stdout.',
            type: 'string',
            normalize: true,
          })
          .option('watch', {
            alias: 'w',
            describe: 'Watch files for changes and regenerate schemas. (Not yet implemented)',
            type: 'boolean',
            hidden: true, // Hide until implemented
          });
      },
      async (argv) => {
        await handleCommand(argv);
      }
    )
    .help()
    .alias('h', 'help')
    .version(pkg.version)
    .alias('v', 'version')
    .epilogue(`For more information, visit ${pkg.homepage}`)
    .strict()
    .fail((msg, err, yargs) => {
      console.error(kleur.red('Error:'), msg);
      if (err) {
        console.error(kleur.red('Details:'), err.message);
      }
      console.error('\n' + yargs.help());
      process.exit(1);
    }).argv;
}

/**
 * Handles the core logic after arguments are parsed.
 * It resolves file paths, processes them, and handles output.
 *
 * @param {object} argv - The parsed arguments object from yargs.
 */
async function handleCommand(argv) {
  const { files: patterns, output: outputDir } = argv;

  try {
    const filePaths = await glob(patterns, {
      ignore: ['node_modules/**'],
      nodir: true,
    });

    if (filePaths.length === 0) {
      console.warn(kleur.yellow('Warning: No matching files found for the provided patterns.'));
      return;
    }

    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
      console.log(kleur.cyan(`Processing ${filePaths.length} file(s)...`));
    }

    const results = await Promise.allSettled(
      filePaths.map(async (filePath) => {
        try {
          const { zodSchema } = await processFile(filePath);
          return { filePath, zodSchema, status: 'fulfilled' };
        } catch (error) {
          return { filePath, error, status: 'rejected' };
        }
      })
    );

    let successCount = 0;
    let generatedContent = '';

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { filePath, zodSchema } = result.value;
        if (zodSchema) {
          successCount++;
          if (outputDir) {
            await writeSchemaFile(filePath, zodSchema, outputDir);
          } else {
            generatedContent += zodSchema;
          }
        }
      } else {
        console.error(kleur.red(`\nError processing ${result.reason.filePath || 'a file'}:`));
        console.error(kleur.gray(result.reason.error?.message || 'Unknown error'));
      }
    }

    if (!outputDir) {
      if (generatedContent) {
        process.stdout.write(generatedContent);
      } else {
        console.log(kleur.gray('// No convertible JSDoc comments found.'));
      }
    } else {
      console.log(kleur.green(`\nSuccessfully generated schemas for ${successCount} out of ${filePaths.length} file(s).`));
      console.log(kleur.cyan(`Output written to directory: ${outputDir}`));
    }

  } catch (error) {
    console.error(kleur.red('A critical error occurred:'), error.message);
    process.exit(1);
  }
}

/**
 * Writes the generated Zod schema content to a file in the output directory.
 * The output filename is derived from the original source file's name.
 *
 * @param {string} sourcePath - The path of the original source file.
 * @param {string} schemaContent - The generated Zod schema string.
 * @param {string} outputDir - The directory to write the new file to.
 */
async function writeSchemaFile(sourcePath, schemaContent, outputDir) {
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const outputFileName = `${baseName}.schema.js`;
  const outputPath = path.join(outputDir, outputFileName);

  try {
    await fs.writeFile(outputPath, schemaContent, 'utf8');
    console.log(kleur.gray(`  -> Generated ${outputPath}`));
  } catch (error) {
    console.error(kleur.red(`Failed to write schema file for ${sourcePath}:`), error.message);
  }
}