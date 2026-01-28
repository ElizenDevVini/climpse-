import { execa } from 'execa';
import { platform } from 'os';

/**
 * Opens URLs in the user's default browser.
 * For now we use OS-native open commands.
 * Playwright integration can be added later for more complex browser automation.
 */
export class BrowserAutomation {
  async openUrl(url: string): Promise<void> {
    const os = platform();

    try {
      if (os === 'darwin') {
        await execa('open', [url]);
      } else if (os === 'linux') {
        await execa('xdg-open', [url]);
      } else if (os === 'win32') {
        await execa('cmd', ['/c', 'start', url]);
      } else {
        throw new Error(`Unsupported platform: ${os}`);
      }
    } catch (err) {
      throw new Error(`Failed to open URL ${url}: ${(err as Error).message}`);
    }
  }

  async openUrls(urls: string[], delayMs: number = 1000): Promise<void> {
    for (const url of urls) {
      await this.openUrl(url);
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
}
