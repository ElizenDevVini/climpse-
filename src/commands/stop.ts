import { DaemonManager } from '../daemon/index.js';

export async function stopCommand(): Promise<void> {
  const daemon = new DaemonManager();

  if (!(await daemon.isRunning())) {
    console.log('Climpse is not running.');
    return;
  }

  try {
    await daemon.stop();
    console.log('Climpse stopped.');
  } catch (err) {
    console.error('Failed to stop Climpse:', (err as Error).message);
    process.exit(1);
  }
}
