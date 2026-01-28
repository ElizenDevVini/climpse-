import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execa } from 'execa';
import { LaunchdService } from './launchd.js';
import { SystemdService } from './systemd.js';

const PID_FILE = join(homedir(), '.climpse', 'daemon.pid');

export class DaemonManager {
  async isRunning(): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) return false;

    try {
      // Check if process exists
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      this.removePidFile();
      return false;
    }
  }

  async getPid(): Promise<number | null> {
    if (!existsSync(PID_FILE)) return null;
    try {
      const raw = readFileSync(PID_FILE, 'utf-8').trim();
      const pid = parseInt(raw, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  async start(): Promise<void> {
    if (await this.isRunning()) {
      throw new Error('Daemon is already running');
    }

    // Find the climpse executable
    const climpseMain = join(import.meta.url.replace('file://', ''), '..', '..', 'daemon', 'run.js');

    // Determine the actual path to run.js
    const scriptPath = new URL('../daemon/run.js', import.meta.url).pathname;

    const child = execa('node', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    if (child.pid) {
      this.writePidFile(child.pid);
    }
  }

  async stop(): Promise<void> {
    const pid = await this.getPid();
    if (!pid) {
      throw new Error('Daemon is not running');
    }

    try {
      process.kill(pid, 'SIGTERM');
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          try {
            process.kill(pid, 0);
          } catch {
            clearInterval(check);
            resolve();
          }
        }, 100);

        // Force kill after 5 seconds
        setTimeout(() => {
          clearInterval(check);
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // Already dead
          }
          resolve();
        }, 5000);
      });
    } finally {
      this.removePidFile();
    }
  }

  async install(): Promise<void> {
    const os = platform();
    if (os === 'darwin') {
      const launchd = new LaunchdService();
      await launchd.install();
    } else if (os === 'linux') {
      const systemd = new SystemdService();
      await systemd.install();
    } else {
      throw new Error(`Service installation not supported on ${os}`);
    }
  }

  async uninstall(): Promise<void> {
    const os = platform();
    if (os === 'darwin') {
      const launchd = new LaunchdService();
      await launchd.uninstall();
    } else if (os === 'linux') {
      const systemd = new SystemdService();
      await systemd.uninstall();
    }
  }

  private writePidFile(pid: number): void {
    writeFileSync(PID_FILE, pid.toString(), 'utf-8');
  }

  private removePidFile(): void {
    try {
      unlinkSync(PID_FILE);
    } catch {
      // Ignore
    }
  }
}
