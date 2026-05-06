/**
 * @file src/generator/project-scaffolder.js
 * @description Orchestrates the entire API generation process.
 *
 * This module is the master conductor of code generation. It takes the structured
 * endpoint data from the analysis phase and an output directory, then performs
 * all necessary file system operations and template rendering to create a complete,
 * runnable Express.js project. It creates the directory structure, generates
 * the `package.json`, the main `server.js`, and the `router.js` files, and
 * ensures all generated code is properly formatted and linted.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { renderTemplate } from './template-renderer.js';
import { formatAndLintCode } from './code-formatter.js';

/**
 * Orchestrates the entire project scaffolding and code generation process.
 *
 * This is the main exported function that ties everything together. It performs the following steps:
 * 1. Ensures the output directory exists.
 * 2. Renders the `package.json`, `server.js`, and `router.js` templates using the provided endpoint data.
 * 3. Formats and lints the generated JavaScript code for production quality.
 * 4. Writes the final, polished files to the output directory.
 *
 * @param {string} outputDir - The absolute path to the directory where the project will be generated.
 * @param {Array<object>} endpoints - An array of endpoint objects from the `endpoint-analyzer`.
 * @returns {Promise<void>} A promise that resolves when the entire scaffolding process is complete.
 * @throws {Error} If the output directory cannot be created or if any file generation step fails.
 */
export async function scaffoldProject(outputDir, endpoints) {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('An output directory must be provided.');
  }
  if (!Array.isArray(endpoints)) {
    throw new Error('Endpoint data must be provided as an array.');
  }

  try {
    // Step 1: Ensure the output directory exists, creating it recursively if needed.
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Output directory ensured at: ${outputDir}`);

    // Step 2: Generate all necessary project files concurrently.
    await Promise.all([
      generatePackageJson(outputDir),
      generateServer(outputDir),
      generateRouter(outputDir, endpoints),
    ]);

    console.log(
      '\n✅ API generation complete! Your project has been scaffolded in:',
    );
    console.log(`   ${outputDir}`);
    console.log('\nTo get started:');
    console.log(`   cd ${path.relative(process.cwd(), outputDir)}`);
    console.log('   npm install');
    console.log('   npm start');
  } catch (error) {
    console.error(`\n❌ Project scaffolding failed: ${error.message}`);
    // Re-throw the error to allow the calling process (e.g., the CLI) to exit with a non-zero code.
    throw error;
  }
}

/**
 * Generates, formats, and writes the `package.json` file for the new project.
 *
 * @param {string} outputDir - The root directory of the generated project.
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function generatePackageJson(outputDir) {
  const templateName = 'package.json.ejs';
  const fileName = 'package.json';
  const filePath = path.join(outputDir, fileName);

  try {
    console.log(`Generating ${fileName}...`);
    // The package.json template currently doesn't require dynamic data,
    // but we pass an empty object for consistency.
    const rawContent = await renderTemplate(templateName, {});

    // package.json doesn't need linting, just formatting.
    const formattedContent = await formatFileContent(rawContent, fileName);

    await fs.writeFile(filePath, formattedContent);
    console.log(`Successfully wrote ${fileName}`);
  } catch (error) {
    throw new Error(`Failed to generate ${fileName}: ${error.message}`);
  }
}

/**
 * Generates, formats, and writes the main `server.js` file.
 *
 * @param {string} outputDir - The root directory of the generated project.
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function generateServer(outputDir) {
  const templateName = 'server.js.ejs';
  const fileName = 'server.js';
  const filePath = path.join(outputDir, fileName);

  try {
    console.log(`Generating ${fileName}...`);
    // The server template is generic and doesn't need endpoint-specific data.
    const rawContent = await renderTemplate(templateName, {});
    const formattedContent = await formatFileContent(rawContent, fileName);

    await fs.writeFile(filePath, formattedContent);
    console.log(`Successfully wrote ${fileName}`);
  } catch (error) {
    throw new Error(`Failed to generate ${fileName}: ${error.message}`);
  }
}

/**
 * Generates, formats, and writes the `router.js` file containing all API routes.
 *
 * @param {string} outputDir - The root directory of the generated project.
 * @param {Array<object>} endpoints - The array of analyzed endpoint definitions.
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function generateRouter(outputDir, endpoints) {
  const templateName = 'router.js.ejs';
  const fileName = 'router.js';
  const filePath = path.join(outputDir, fileName);

  // Group endpoints by their service file path to generate organized imports.
  const services = groupEndpointsByService(endpoints);

  try {
    console.log(`Generating ${fileName}...`);
    const rawContent = await renderTemplate(templateName, { endpoints, services });
    const formattedContent = await formatFileContent(rawContent, fileName);

    await fs.writeFile(filePath, formattedContent);
    console.log(`Successfully wrote ${fileName}`);
  } catch (error) {
    throw new Error(`Failed to generate ${fileName}: ${error.message}`);
  }
}

/**
 * Groups a flat list of endpoints by their source service file.
 * This is a helper function to structure data for the router template,
 * allowing it to generate `import` statements cleanly.
 *
 * @param {Array<object>} endpoints - The flat list of endpoint objects.
 * @returns {Array<{path: string, functions: string[]}>} An array of service objects,
 *          each with a path and a list of function names to import.
 */
function groupEndpointsByService(endpoints) {
  const serviceMap = new Map();

  for (const endpoint of endpoints) {
    const { servicePath, handlerName } = endpoint;
    if (!serviceMap.has(servicePath)) {
      serviceMap.set(servicePath, new Set());
    }
    serviceMap.get(servicePath).add(handlerName);
  }

  const services = [];
  for (const [servicePath, functionsSet] of serviceMap.entries()) {
    services.push({
      // The template will need a relative path from the generated `router.js`
      // to the original service file. We assume a flat structure for now.
      // A more robust solution might calculate a true relative path.
      // e.g., `../examples/services/user-service.js`
      path: `../${servicePath.replace(/\\/g, '/')}`,
      functions: Array.from(functionsSet),
    });
  }

  return services;
}

/**
 * A wrapper function to format and lint generated file content.
 * It handles JSON files (which only need formatting) and JS files.
 *
 * @param {string} content - The raw string content of the generated file.
 * @param {string} fileName - The name of the file (e.g., 'server.js').
 * @returns {Promise<string>} The processed, high-quality code string.
 */
async function formatFileContent(content, fileName) {
  if (fileName.endsWith('.json')) {
    // For JSON, Prettier with the 'json' parser is sufficient.
    return await prettier.format(content, { parser: 'json' });
  }
  if (fileName.endsWith('.js')) {
    // For JS, use the full format and lint pipeline.
    return await formatAndLintCode(content, fileName);
  }
  // For other file types, return content as-is.
  return content;
}