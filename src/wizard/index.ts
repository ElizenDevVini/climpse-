import * as p from '@clack/prompts';
import { checkPermissions } from './permissions.js';
import { configureLLM } from './llm.js';
import { setupWorkspace, saveConfig, getConfigDir, type ClimpseConfig } from './workspace.js';
import { DaemonManager } from '../daemon/index.js';
import { mkdirSync, existsSync } from 'fs';

export async function runWizard(): Promise<void> {
  p.intro('Welcome to Climpse — AI that learns by watching you');

  console.log('');
  console.log('  Climpse observes your apps and window titles to learn');
  console.log('  your workflow patterns, then offers to automate them.');
  console.log('  All data stays local on your machine.');
  console.log('');

  const shouldContinue = await p.confirm({
    message: 'Climpse needs screen recording permission. Continue?',
  });

  if (p.isCancel(shouldContinue) || !shouldContinue) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Check permissions
  const permissionsOk = await checkPermissions();
  if (!permissionsOk) {
    p.log.warn(
      'Some permissions may not be available. Climpse will work with reduced functionality.'
    );
  }

  // Configure LLM
  const llmConfig = await configureLLM();

  // Setup workspace
  const workspace = await setupWorkspace();

  // Install as service?
  const installService = await p.confirm({
    message: 'Install as background service? (recommended)',
    initialValue: true,
  });

  if (p.isCancel(installService)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Save config
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config: ClimpseConfig = {
    llm: llmConfig,
    workspace,
    installDate: new Date().toISOString(),
    observerInterval: 3000,
    screenshotOnAppSwitch: true,
    screenshotInterval: 30000,
    patternThreshold: 3,
    patternDaysWindow: 7,
  };

  saveConfig(config);

  if (installService && !p.isCancel(installService)) {
    const daemon = new DaemonManager();
    try {
      await daemon.install();
      p.log.success('Background service installed.');
    } catch (err) {
      p.log.warn(`Could not install service: ${(err as Error).message}`);
      p.log.info('You can still run Climpse manually with `climpse start`.');
    }
  }

  p.outro('Climpse installed! Run `climpse start` to begin observing.');
}
