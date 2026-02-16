import { Command } from 'commander';
import chalk from 'chalk';
import { changeLogLevel, listLogModules } from './lib/log-changer.js';

const program = new Command();

program
  .name('log-level-changer')
  .description('Dynamically change the log level of a running Node.js application.')
  .version('1.0.0');

program
  .command('set <pid> <level>')
  .alias('s')
  .description('Set the global log level for a running process.')
  .option('-m, --module <moduleName>', 'Specify a module to change log level for (optional, defaults to global).')
  .action(async (pid, level, options) => {
    try {
      await changeLogLevel(parseInt(pid, 10), options.module, level);
      if (options.module) {
        console.log(chalk.green(`Successfully sent request to change log level for module "${options.module}" to "${level}" in process ${pid}.`));
      } else {
        console.log(chalk.green(`Successfully sent request to change global log level to "${level}" in process ${pid}.`));
      }
    } catch (error) {
      console.error(chalk.red(`Error setting log level: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list <pid>')
  .alias('l')
  .description('List available modules that can have their log level changed in a running process.')
  .action(async (pid) => {
    try {
      const modules = await listLogModules(parseInt(pid, 10));
      if (modules && modules.length > 0) {
        console.log(chalk.blue(`Available modules in process ${pid}:`));
        modules.forEach(moduleName => {
          console.log(`- ${chalk.cyan(moduleName)}`);
        });
      } else {
        console.log(chalk.yellow(`No specific modules found for log level control in process ${pid}. Global level can still be changed.`));
      }
    } catch (error) {
      console.error(chalk.red(`Error listing modules: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export default program;