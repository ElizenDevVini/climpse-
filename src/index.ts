#!/usr/bin/env node

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { setupCommand } from './commands/setup.js';
import { patternsCommand } from './commands/patterns.js';
import { logsCommand } from './commands/logs.js';

const program = new Command();

program
  .name('climpse')
  .description('AI that watches you work, learns your patterns, and automates them.')
  .version('0.1.0');

program
  .command('setup')
  .description('Run the setup wizard')
  .action(setupCommand);

program
  .command('start')
  .description('Start the Climpse daemon')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the Climpse daemon')
  .action(stopCommand);

program
  .command('status')
  .description('Check if Climpse is running')
  .action(statusCommand);

program
  .command('patterns')
  .description('List learned patterns')
  .option('--approve <name>', 'Approve a pattern for automation')
  .option('--reject <name>', 'Reject a pattern')
  .action(patternsCommand);

program
  .command('logs')
  .description('View activity logs')
  .option('-n, --lines <number>', 'Number of recent entries', '20')
  .action(logsCommand);

program.parse();
