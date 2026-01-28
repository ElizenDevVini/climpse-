import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';

// screenshot-desktop has no type declarations — declare inline
type ScreenshotFn = (options?: { filename?: string; format?: string }) => Promise<Buffer>;

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
      const mod = await (import('screenshot-desktop' as string) as Promise<{ default: ScreenshotFn }>);
      const screenshotDesktop = mod.default;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = join(this.screenshotDir, filename);

      const buffer = await screenshotDesktop({ filename: filepath });
      if (!existsSync(filepath)) {
        // Some versions return the buffer instead of writing to disk
        writeFileSync(filepath, buffer);
      }
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
