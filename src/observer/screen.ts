import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';

export class ScreenCapture {
  private screenshotDir: string;
  private maxAgeMs: number;

  constructor(workspacePath: string, maxAgeHours: number = 48) {
    this.screenshotDir = join(workspacePath, 'activity', 'screenshots');
    this.maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    if (!existsSync(this.screenshotDir)) {
      mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async capture(): Promise<string | null> {
    try {
      const screenshotDesktop = await import('screenshot-desktop');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = join(this.screenshotDir, filename);

      await screenshotDesktop.default({ filename: filepath });
      return filepath;
    } catch (err) {
      // Screenshot may fail if no display, permissions, etc.
      console.error('Screenshot failed:', (err as Error).message);
      return null;
    }
  }

  pruneOld(): void {
    try {
      const now = Date.now();
      const files = readdirSync(this.screenshotDir);

      for (const file of files) {
        const filepath = join(this.screenshotDir, file);
        try {
          const stat = statSync(filepath);
          if (now - stat.mtimeMs > this.maxAgeMs) {
            unlinkSync(filepath);
          }
        } catch {
          // Ignore errors on individual files
        }
      }
    } catch {
      // Ignore errors during pruning
    }
  }
}
