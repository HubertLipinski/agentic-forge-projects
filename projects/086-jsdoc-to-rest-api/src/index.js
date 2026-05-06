/**
 * @file src/index.js
 * @description Main entry point for the JSDoc to REST API generator.
 *
 * This module orchestrates the entire generation process. It is called by the
 * CLI script (`bin/generate-api.js`) with the source and output directories.
 * It then sequences the operations: finding files, parsing them, analyzing the
 * data, and finally scaffolding the new Express.js project.
 */

import path from 'node:path';
import { findJavaScriptFiles } from './utils/file-system.js';
import { parseFile } from './parser/ast-parser.js';
import { analyzeEndpoints } from './analyzer/endpoint-analyzer.js';
import { scaffoldProject } from './generator/project-scaffolder.js';
import { transformJSDocTypeToSchema } from './transformer/schema-transformer.js';

/**
 * Main orchestration function for the API generation process.
 *
 * This function takes the source and output paths, then executes the end-to-end
 * process of generating a REST API server.
 *
 * The process is as follows:
 * 1.  **Discover**: Recursively find all JavaScript files in the source directory.
 * 2.  **Parse**: For each file, parse the source code into an AST and extract
 *     function/method nodes along with their associated JSDoc comments.
 * 3.  **Analyze**: Synthesize the parsed data into a structured list of API
 *     endpoints, filtering for those with `@route` tags and validating their structure.
 *     This step also transforms JSDoc type info into JSON schemas.
 * 4.  **Generate**: Use the structured endpoint data to scaffold a complete
 *     Express.js project in the specified output directory, including a `package.json`,
 *     `server.js`, and `router.js`.
 *
 * @param {object} options - The configuration options for generation.
 * @param {string} options.source - The path to the source directory containing service files.
 * @param {string} options.output - The path to the output directory for the generated project.
 * @returns {Promise<void>} A promise that resolves when the generation is complete, or rejects on error.
 */
export async function generateApi({ source, output }) {
  if (!source || !output) {
    throw new Error('Both source and output directory paths are required.');
  }

  const sourcePath = path.resolve(source);
  const outputPath = path.resolve(output);

  console.log('🚀 Starting API generation...');
  console.log(`  Source directory: ${sourcePath}`);
  console.log(`  Output directory: ${outputPath}`);
  console.log('------------------------------------------');

  try {
    // 1. Discover all relevant source files
    console.log('1. Discovering JavaScript files...');
    const files = await findJavaScriptFiles(sourcePath);
    if (files.length === 0) {
      console.warn(`No JavaScript files found in "${sourcePath}".`);
      console.log('Generation finished with no files to process.');
      return;
    }
    console.log(`   Found ${files.length} JavaScript file(s).`);

    // 2. Parse files to extract AST nodes and JSDoc comments
    console.log('2. Parsing files and extracting JSDoc...');
    const parsePromises = files.map((file) => parseFile(file));
    const documentedNodesPerFile = await Promise.all(parsePromises);
    const allDocumentedNodes = documentedNodesPerFile.flat();
    console.log(
      `   Found ${allDocumentedNodes.length} functions/methods with JSDoc comments.`,
    );

    // 3. Analyze parsed data to build endpoint definitions
    console.log('3. Analyzing endpoints...');
    const rawEndpoints = await analyzeEndpoints(allDocumentedNodes);
    if (rawEndpoints.length === 0) {
      console.warn(
        'No functions with valid @route tags were found. No API will be generated.',
      );
      return;
    }

    // 3a. Enhance endpoints with transformed JSON schemas
    // We separate this from the initial analysis to keep concerns distinct.
    // `endpoint-analyzer` creates the structure, `schema-transformer` populates schemas.
    const endpoints = rawEndpoints.map(transformEndpointSchemas);
    console.log(`   Analyzed and structured ${endpoints.length} API endpoint(s).`);

    // 4. Generate the project structure and code files
    console.log('4. Scaffolding project and generating code...');
    await scaffoldProject(outputPath, endpoints);
  } catch (error) {
    console.error(
      '\n------------------------------------------',
      '\n🔥 An error occurred during API generation:',
      `\n   ${error.message}`,
    );
    // Propagate the error to the CLI to exit with a non-zero status code
    throw error;
  }
}

/**
 * Transforms the JSDoc type strings within a single analyzed endpoint object
 * into full JSON Schema objects using the schema-transformer.
 *
 * This function is a pure transformation that takes a raw endpoint and returns
 * an enhanced one. It's applied to each endpoint after initial analysis.
 *
 * @param {object} endpoint - The raw endpoint object from `endpoint-analyzer`.
 * @returns {object} A new endpoint object with `schema` properties populated.
 */
function transformEndpointSchemas(endpoint) {
  // Use structuredClone for a deep copy to avoid mutating the original object.
  const newEndpoint = structuredClone(endpoint);

  // Transform body schema
  if (newEndpoint.parameters.body?.schema) {
    newEndpoint.parameters.body.schema = transformJSDocTypeToSchema(
      newEndpoint.parameters.body.schema,
    );
  }

  // Transform path parameter schemas
  newEndpoint.parameters.path.forEach((param) => {
    if (param.schema) {
      param.schema = transformJSDocTypeToSchema(param.schema);
    }
  });

  // Transform query parameter schemas
  newEndpoint.parameters.query.forEach((param) => {
    if (param.schema) {
      param.schema = transformJSDocTypeToSchema(param.schema);
    }
  });

  // Transform response schemas
  newEndpoint.responses.forEach((response) => {
    if (response.schema) {
      response.schema = transformJSDocTypeToSchema(response.schema);
    }
  });

  return newEndpoint;
}