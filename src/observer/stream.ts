import { join } from 'path';
import { ActivityDB, type ActivityEntry } from './activity.js';
import { ScreenCapture } from './screen.js';
import { OCRProcessor } from './ocr.js';
import type { ClimpseConfig } from '../wizard/workspace.js';

export interface ObserverCallbacks {
  onActivity?: (entry: ActivityEntry) => void;
  onAppSwitch?: (from: string, to: string) => void;
  onError?: (error: Error) => void;
}

export class ActivityStream {
  private config: ClimpseConfig;
  private db: ActivityDB | null = null;
  private screen: ScreenCapture;
  private ocr: OCRProcessor;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private screenshotInterval: ReturnType<typeof setInterval> | null = null;
  private pruneInterval: ReturnType<typeof setInterval> | null = null;
  private lastApp: string = '';
  private lastTitle: string = '';
  private buffer: ActivityEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private callbacks: ObserverCallbacks;
  private currentDbDate: string = '';

  constructor(config: ClimpseConfig, callbacks: ObserverCallbacks = {}) {
    this.config = config;
    this.screen = new ScreenCapture(config.workspace);
    this.ocr = new OCRProcessor();
    this.callbacks = callbacks;
  }

  private getDB(): ActivityDB {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.currentDbDate || !this.db) {
      if (this.db) {
        this.flushBuffer();
        this.db.close();
      }
      const dbPath = join(this.config.workspace, 'activity', `${today}.db`);
      this.db = new ActivityDB(dbPath);
      this.currentDbDate = today;
    }
    return this.db;
  }

  async start(): Promise<void> {
    // Poll active window
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollActiveWindow();
      } catch (err) {
        this.callbacks.onError?.(err as Error);
      }
    }, this.config.observerInterval);

    // Periodic screenshots (every 30s of activity)
    this.screenshotInterval = setInterval(async () => {
      try {
        await this.screen.capture();
      } catch (err) {
        // Non-critical, don't crash
      }
    }, this.config.screenshotInterval);

    // Flush buffer every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 10000);

    // Prune old screenshots every hour
    this.pruneInterval = setInterval(() => {
      this.screen.pruneOld();
    }, 60 * 60 * 1000);

    // Initial poll
    await this.pollActiveWindow();
  }

  private async pollActiveWindow(): Promise<void> {
    try {
      const { activeWindow } = await import('active-win');
      const win = await activeWindow();

      if (!win) return;

      const appName = win.owner.name;
      const windowTitle = win.title;

      // Skip if nothing changed
      if (appName === this.lastApp && windowTitle === this.lastTitle) {
        return;
      }

      const isAppSwitch = appName !== this.lastApp;

      const entry: ActivityEntry = {
        timestamp: new Date().toISOString(),
        app_name: appName,
        window_title: windowTitle,
        url: 'url' in win ? (win as Record<string, unknown>).url as string | undefined : undefined,
      };

      // Screenshot on app switch
      if (isAppSwitch && this.config.screenshotOnAppSwitch) {
        const screenshotPath = await this.screen.capture();
        if (screenshotPath) {
          entry.screenshot_path = screenshotPath;
        }

        if (this.lastApp) {
          this.callbacks.onAppSwitch?.(this.lastApp, appName);
        }
      }

      this.buffer.push(entry);
      this.callbacks.onActivity?.(entry);

      this.lastApp = appName;
      this.lastTitle = windowTitle;
    } catch {
      // active-win can fail if permissions are missing
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    try {
      const db = this.getDB();
      db.insertBatch(this.buffer);
      this.buffer = [];
    } catch (err) {
      this.callbacks.onError?.(err as Error);
    }
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }

    this.flushBuffer();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    await this.ocr.terminate();
  }
}
