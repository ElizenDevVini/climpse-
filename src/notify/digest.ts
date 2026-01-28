import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { SystemNotifier } from './system.js';
import { ActivityDB } from '../observer/activity.js';
import type { MessagingHub } from '../messaging/index.js';

export class DailyDigest {
  private workspacePath: string;
  private notifier: SystemNotifier;
  private messaging: MessagingHub | null;

  constructor(workspacePath: string, messaging?: MessagingHub | null) {
    this.workspacePath = workspacePath;
    this.notifier = new SystemNotifier();
    this.messaging = messaging ?? null;
  }

  async generate(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const dbPath = join(this.workspacePath, 'activity', `${today}.db`);

    let activitySummary = 'No activity recorded today.';

    if (existsSync(dbPath)) {
      const db = new ActivityDB(dbPath);
      const count = db.count();
      const apps = db.getDistinctApps();
      db.close();

      activitySummary = `Tracked ${count} window changes across ${apps.length} apps today.`;
      if (apps.length > 0) {
        activitySummary += `\nApps used: ${apps.slice(0, 10).join(', ')}${apps.length > 10 ? '...' : ''}`;
      }
    }

    // Check patterns
    const patternsDir = join(this.workspacePath, 'patterns');
    let patternSummary = '';

    if (existsSync(patternsDir)) {
      const files = readdirSync(patternsDir).filter(f => f.endsWith('.md'));
      const pending = files.filter(f => {
        const content = readFileSync(join(patternsDir, f), 'utf-8');
        return content.includes('Pending user approval');
      });

      if (pending.length > 0) {
        patternSummary = `\n${pending.length} pattern(s) awaiting your approval.`;
      }
      if (files.length > 0) {
        patternSummary += `\n${files.length} total pattern(s) learned.`;
      }
    }

    return `Climpse Daily Summary\n${activitySummary}${patternSummary}`;
  }

  async sendDigest(): Promise<void> {
    const summary = await this.generate();
    await this.notifier.notifySimple('Climpse Daily Summary', summary);

    if (this.messaging) {
      await this.messaging.sendDailyDigest(summary);
    }
  }
}
