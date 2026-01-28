import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execa } from 'execa';

const PLIST_NAME = 'dev.climpse.daemon';
const PLIST_PATH = join(
  homedir(),
  'Library',
  'LaunchAgents',
  `${PLIST_NAME}.plist`
);

export class LaunchdService {
  async install(): Promise<void> {
    const nodePath = process.execPath;
    const scriptPath = this.getScriptPath();
    const logDir = join(homedir(), '.climpse', 'logs');

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${scriptPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(logDir, 'stdout.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(logDir, 'stderr.log')}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;

    const launchAgentsDir = join(homedir(), 'Library', 'LaunchAgents');
    if (!existsSync(launchAgentsDir)) {
      mkdirSync(launchAgentsDir, { recursive: true });
    }

    writeFileSync(PLIST_PATH, plist, 'utf-8');

    try {
      await execa('launchctl', ['load', PLIST_PATH]);
    } catch (err) {
      throw new Error(`Failed to load launchd service: ${(err as Error).message}`);
    }
  }

  async uninstall(): Promise<void> {
    try {
      await execa('launchctl', ['unload', PLIST_PATH]);
    } catch {
      // May already be unloaded
    }

    try {
      unlinkSync(PLIST_PATH);
    } catch {
      // May not exist
    }
  }

  private getScriptPath(): string {
    return new URL('./run.js', import.meta.url).pathname;
  }
}
