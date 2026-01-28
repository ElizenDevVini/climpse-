import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export interface ActivityEntry {
  id?: number;
  timestamp: string;
  app_name: string;
  window_title: string;
  url?: string;
  screenshot_path?: string;
}

export class ActivityDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        app_name TEXT NOT NULL,
        window_title TEXT NOT NULL,
        url TEXT,
        screenshot_path TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activity_app ON activity(app_name);
    `);
  }

  insert(entry: ActivityEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO activity (timestamp, app_name, window_title, url, screenshot_path)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.timestamp,
      entry.app_name,
      entry.window_title,
      entry.url ?? null,
      entry.screenshot_path ?? null
    );
  }

  insertBatch(entries: ActivityEntry[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO activity (timestamp, app_name, window_title, url, screenshot_path)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: ActivityEntry[]) => {
      for (const entry of items) {
        stmt.run(
          entry.timestamp,
          entry.app_name,
          entry.window_title,
          entry.url ?? null,
          entry.screenshot_path ?? null
        );
      }
    });

    transaction(entries);
  }

  getRecent(limit: number = 20): ActivityEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(limit) as ActivityEntry[];
  }

  getRange(start: string, end: string): ActivityEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM activity
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(start, end) as ActivityEntry[];
  }

  getAll(): ActivityEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM activity ORDER BY timestamp ASC
    `);
    return stmt.all() as ActivityEntry[];
  }

  getDistinctApps(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT app_name FROM activity ORDER BY app_name
    `);
    const rows = stmt.all() as Array<{ app_name: string }>;
    return rows.map(r => r.app_name);
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM activity');
    const row = stmt.get() as { cnt: number };
    return row.cnt;
  }

  close(): void {
    this.db.close();
  }
}
