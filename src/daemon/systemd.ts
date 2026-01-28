import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execa } from 'execa';

const SERVICE_NAME = 'climpse';
const SERVICE_PATH = join(
  homedir(),
  '.config',
  'systemd',
  'user',
  `${SERVICE_NAME}.service`
);

export class SystemdService {
  async install(): Promise<void> {
    const nodePath = process.execPath;
    const scriptPath = this.getScriptPath();

    const unit = `[Unit]
Description=Climpse - AI pattern observer
After=graphical-session.target

[Service]
Type=simple
ExecStart=${nodePath} ${scriptPath}
Restart=on-failure
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
`;

    const serviceDir = join(homedir(), '.config', 'systemd', 'user');
    if (!existsSync(serviceDir)) {
      mkdirSync(serviceDir, { recursive: true });
    }

    writeFileSync(SERVICE_PATH, unit, 'utf-8');

    try {
      await execa('systemctl', ['--user', 'daemon-reload']);
      await execa('systemctl', ['--user', 'enable', SERVICE_NAME]);
      await execa('systemctl', ['--user', 'start', SERVICE_NAME]);
    } catch (err) {
      throw new Error(`Failed to install systemd service: ${(err as Error).message}`);
    }
  }

  async uninstall(): Promise<void> {
    try {
      await execa('systemctl', ['--user', 'stop', SERVICE_NAME]);
      await execa('systemctl', ['--user', 'disable', SERVICE_NAME]);
    } catch {
      // May already be stopped
    }

    try {
      unlinkSync(SERVICE_PATH);
      await execa('systemctl', ['--user', 'daemon-reload']);
    } catch {
      // May not exist
    }
  }

  private getScriptPath(): string {
    return new URL('./run.js', import.meta.url).pathname;
  }
}
