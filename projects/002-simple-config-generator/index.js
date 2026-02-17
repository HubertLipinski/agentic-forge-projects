import { Command, Option } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateConfig } from './lib/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('config-gen')
  .description('A command-line tool that generates basic configuration files (e.g., JSON, YAML) based on a predefined template and user-provided values.')
  .version('1.0.0');

program
  .requiredOption('-t, --template <templatePath>', 'Path to the EJS template file.')
  .option('-o, --output <outputPath>', 'Path to the output file. If not provided, output goes to stdout.')
  .option('-f, --format <format>', 'Output format (json or yaml). Defaults to json.', 'json')
  .argument('[inputValues...]', 'Key-value pairs for template variables (e.g., key=value, nested.key=value).')
  .action(async (inputValues, options) => {
    const { template, output, format } = options;

    if (format !== 'json' && format !== 'yaml') {
      console.error(`Error: Invalid format "${format}". Supported formats are "json" and "yaml".`);
      process.exit(1);
    }

    try {
      await generateConfig(template, output, inputValues, format);
      if (!output) {
        console.log('Configuration generated successfully to stdout.');
      } else {
        console.log(`Configuration generated successfully to "${path.resolve(output)}".`);
      }
    } catch (error) {
      console.error(`Error generating configuration: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);