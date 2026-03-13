#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description Command-line interface for the Process Health Checker.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { Command } from 'commander';
import { getProcessHealth } from '../src/monitor.js';
import { formatUptime, formatMemory } from '../src/utils.js';

/**
 * Displays the health status of a process in a user-friendly format.
 *
 * @param {object} healthStatus - The health status object from getProcessHealth.
 */
function displayHealthStatus(healthStatus) {
  const { pid, memory, cpu, uptime } = healthStatus;

  console.log(`\n--- Process Health Report for PID: ${pid} ---`);
  console.log(`  Uptime     : ${formatUptime(uptime)}`);
  console.log(`  Memory Usage:`);
  console.log(`    RSS        : ${formatMemory(memory.rss)}`);
  console.log(`    Heap Total : ${formatMemory(memory.heapTotal)}`);
  console.log(`    Heap Used  : ${formatMemory(memory.heapUsed)}`);
  console.log(`  CPU Time:`);
  console.log(`    User       : ${cpu.user} µs`);
  console.log(`    System     : ${cpu.system} µs`);
  console.log(`------------------------------------------\n`);
}

/**
 * The main entry point for the CLI application.
 * It parses command-line arguments, fetches process health, and displays it.
 */
async function main() {
  const program = new Command();

  program
    .name('health-check')
    .description('A lightweight CLI to monitor the health of a running Node.js process by its PID.')
    .version('1.0.0', '-v, --version', 'Output the current version')
    .argument('<pid>', 'The Process ID of the Node.js process to monitor.')
    .action(async (pid) => {
      try {
        const healthStatus = await getProcessHealth(pid);
        displayHealthStatus(healthStatus);
        process.exit(0);
      } catch (error) {
        console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
        process.exit(1);
      }
    })
    .parseAsync(process.argv);

  // Show help if no arguments are provided.
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch((error) => {
  console.error(`\x1b[31mAn unexpected error occurred: ${error.message}\x1b[0m`);
  process.exit(1);
});