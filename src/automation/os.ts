import { execa } from 'execa';
import { platform } from 'os';

/**
 * OS-level automation: open apps, run scripts.
 */
export class OSAutomation {
  async openApp(appName: string): Promise<void> {
    const os = platform();

    try {
      if (os === 'darwin') {
        await execa('open', ['-a', appName]);
      } else if (os === 'linux') {
        // Try common approaches
        try {
          await execa(appName.toLowerCase());
        } catch {
          // Try with gtk-launch for .desktop files
          await execa('gtk-launch', [appName.toLowerCase()]);
        }
      } else if (os === 'win32') {
        await execa('cmd', ['/c', 'start', appName]);
      }
    } catch (err) {
      throw new Error(`Failed to open app ${appName}: ${(err as Error).message}`);
    }
  }

  async runShellCommand(command: string): Promise<string> {
    try {
      const result = await execa('sh', ['-c', command]);
      return result.stdout;
    } catch (err) {
      throw new Error(`Shell command failed: ${(err as Error).message}`);
    }
  }

  async runAppleScript(script: string): Promise<string> {
    if (platform() !== 'darwin') {
      throw new Error('AppleScript is only available on macOS');
    }

    try {
      const result = await execa('osascript', ['-e', script]);
      return result.stdout;
    } catch (err) {
      throw new Error(`AppleScript failed: ${(err as Error).message}`);
    }
  }
}
