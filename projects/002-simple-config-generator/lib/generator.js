import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import yaml from 'yaml';

/**
 * Reads the content of a file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} The content of the file.
 * @throws {Error} If the file cannot be read.
 */
async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file "${filePath}": ${error.message}`);
  }
}

/**
 * Writes content to a file.
 * @param {string} filePath - The path to the file.
 * @param {string} content - The content to write.
 * @returns {Promise<void>}
 * @throws {Error} If the file cannot be written.
 */
async function writeFileContent(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write to file "${filePath}": ${error.message}`);
  }
}

/**
 * Renders an EJS template with provided data.
 * @param {string} templateContent - The EJS template content.
 * @param {object} data - The data to pass to the template.
 * @returns {Promise<string>} The rendered template content.
 * @throws {Error} If EJS rendering fails.
 */
async function renderTemplate(templateContent, data) {
  try {
    return await ejs.render(templateContent, data);
  } catch (error) {
    throw new Error(`EJS rendering failed: ${error.message}`);
  }
}

/**
 * Parses input key-value pairs into a structured object.
 * Handles nested structures for dot-notation keys.
 * @param {string[]} inputArgs - Array of strings in "key=value" format.
 * @returns {object} The parsed data object.
 */
function parseInputValues(inputArgs) {
  const data = {};

  for (const arg of inputArgs) {
    const [key, ...valueParts] = arg.split('=');
    if (!key) continue;

    const value = valueParts.join('=');
    let current = data;
    const keys = key.split('.');
    const lastKey = keys.pop();

    for (const k of keys) {
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }

    if (lastKey) {
      current[lastKey] = value;
    }
  }
  return data;
}

/**
 * Formats the generated content based on the desired output format.
 * @param {object} data - The data object to format.
 * @param {'json' | 'yaml'} format - The desired output format.
 * @returns {string} The formatted content.
 * @throws {Error} If the format is unsupported.
 */
function formatOutput(data, format) {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.stringify(data);
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

/**
 * Generates a configuration file based on a template and user inputs.
 * @param {string} templatePath - Path to the EJS template file.
 * @param {string | undefined} outputPath - Path to the output file. If not provided, output goes to stdout.
 * @param {string[]} inputArgs - Array of key-value pair strings for template data.
 * @param {'json' | 'yaml'} outputFormat - The desired output format.
 * @returns {Promise<void>}
 */
export async function generateConfig(templatePath, outputPath, inputArgs, outputFormat) {
  const templateContent = await readFileContent(templatePath);
  const inputData = parseInputValues(inputArgs);

  const renderedContent = await renderTemplate(templateContent, inputData);

  let finalOutput;
  try {
    // Attempt to parse the rendered content as JSON or YAML to ensure it's valid
    // before re-formatting it. This helps catch errors in the template's structure.
    if (outputFormat === 'json') {
      finalOutput = JSON.stringify(JSON.parse(renderedContent), null, 2);
    } else if (outputFormat === 'yaml') {
      finalOutput = yaml.stringify(yaml.parse(renderedContent));
    } else {
      // If the template doesn't produce valid JSON/YAML, output as is.
      // This might happen for plain text templates or if the user explicitly wants it.
      // However, given the context of JSON/YAML generation, this is less likely.
      // For robustness, we'll still try to format if possible.
      try {
        finalOutput = formatOutput(JSON.parse(renderedContent), outputFormat);
      } catch (jsonParseError) {
        try {
          finalOutput = formatOutput(yaml.parse(renderedContent), outputFormat);
        } catch (yamlParseError) {
          // If neither JSON nor YAML parsing works, output the raw rendered content.
          finalOutput = renderedContent;
        }
      }
    }
  } catch (formattingError) {
    // If formatting fails (e.g., invalid JSON/YAML structure in rendered output),
    // output the raw rendered content.
    console.warn(`Warning: Could not auto-format rendered content as ${outputFormat}. Outputting raw content. Error: ${formattingError.message}`);
    finalOutput = renderedContent;
  }


  if (outputPath) {
    await writeFileContent(outputPath, finalOutput);
    console.log(`Configuration file generated successfully at "${outputPath}"`);
  } else {
    process.stdout.write(finalOutput);
  }
}