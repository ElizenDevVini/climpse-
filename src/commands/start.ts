import { existsSync } from 'fs';
import { getConfigPath, loadConfig } from '../wizard/workspace.js';
import { DaemonManager } from '../daemon/index.js';

export async function startCommand(): Promise<void> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.error('Climpse is not configured. Run `climpse setup` first.');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    console.error('Failed to load config. Run `climpse setup` to reconfigure.');
    process.exit(1);
  }

  const daemon = new DaemonManager();

  if (await daemon.isRunning()) {
    console.log('Climpse is already running.');
    return;
  }

  try {
    await daemon.start();
    console.log('Climpse started. It will observe your activity and learn your patterns.');
    console.log('Run `climpse status` to check on it.');
  } catch (err) {
    console.error('Failed to start Climpse:', (err as Error).message);
    process.exit(1);
  }
}
