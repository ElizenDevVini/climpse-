import { DaemonManager } from '../daemon/index.js';
import { loadConfig } from '../wizard/workspace.js';
import { existsSync } from 'fs';
import { getConfigPath } from '../wizard/workspace.js';

export async function statusCommand(): Promise<void> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.log('Status: Not configured');
    console.log('Run `climpse setup` to get started.');
    return;
  }

  const config = loadConfig();
  const daemon = new DaemonManager();
  const running = await daemon.isRunning();

  console.log(`Status: ${running ? 'Running' : 'Stopped'}`);
  console.log(`Provider: ${config?.llm?.provider ?? 'not set'}`);
  console.log(`Workspace: ${config?.workspace ?? 'not set'}`);

  if (running) {
    const pid = await daemon.getPid();
    if (pid) {
      console.log(`PID: ${pid}`);
    }
  }
}
