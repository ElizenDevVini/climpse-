import { join } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from '../wizard/workspace.js';
import { ActivityDB } from '../observer/activity.js';

interface LogsOptions {
  lines: string;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  const config = loadConfig();
  if (!config?.workspace) {
    console.error('Climpse is not configured. Run `climpse setup` first.');
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];
  const dbPath = join(config.workspace, 'activity', `${today}.db`);

  if (!existsSync(dbPath)) {
    console.log('No activity logged today yet.');
    return;
  }

  const db = new ActivityDB(dbPath);
  const limit = parseInt(options.lines, 10) || 20;
  const entries = db.getRecent(limit);

  if (entries.length === 0) {
    console.log('No activity logged today yet.');
    db.close();
    return;
  }

  console.log('Recent Activity:\n');

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    console.log(`  ${time}  ${entry.app_name} — ${entry.window_title}`);
  }

  db.close();
}
