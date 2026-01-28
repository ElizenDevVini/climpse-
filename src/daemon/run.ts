/**
 * Daemon entry point.
 * This file is executed by the service manager (launchd/systemd) or manually
 * via `climpse start`. It runs the observer loop and periodically checks
 * for patterns.
 */

import { loadConfig } from '../wizard/workspace.js';
import { ActivityStream } from '../observer/stream.js';
import { PatternDetector } from '../patterns/detector.js';
import { PatternAnalyzer } from '../patterns/analyzer.js';
import { PatternStore } from '../patterns/store.js';
import { ActivityDB } from '../observer/activity.js';
import { SystemNotifier } from '../notify/system.js';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('Climpse not configured. Run `climpse setup` first.');
    process.exit(1);
  }

  console.log(`Climpse daemon starting...`);
  console.log(`Workspace: ${config.workspace}`);
  console.log(`Observer interval: ${config.observerInterval}ms`);

  const notifier = new SystemNotifier();
  const patternStore = new PatternStore(config.workspace);
  const detector = new PatternDetector(
    config.patternThreshold,
  );
  const analyzer = new PatternAnalyzer(config.llm);

  // Start the activity stream
  const stream = new ActivityStream(config, {
    onActivity(entry) {
      // Activity logged
    },
    onAppSwitch(from, to) {
      console.log(`App switch: ${from} → ${to}`);
    },
    onError(error) {
      console.error('Observer error:', error.message);
    },
  });

  await stream.start();
  console.log('Observer started.');

  // Periodic pattern detection (every 30 minutes)
  const patternCheckInterval = setInterval(async () => {
    try {
      await checkPatterns(config.workspace, detector, analyzer, patternStore, notifier, config.patternDaysWindow);
    } catch (err) {
      console.error('Pattern check failed:', (err as Error).message);
    }
  }, 30 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Climpse daemon shutting down...');
    clearInterval(patternCheckInterval);
    await stream.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('Climpse daemon running. Press Ctrl+C to stop.');
}

async function checkPatterns(
  workspacePath: string,
  detector: PatternDetector,
  analyzer: PatternAnalyzer,
  store: PatternStore,
  notifier: SystemNotifier,
  daysWindow: number
): Promise<void> {
  console.log('Checking for patterns...');

  // Load activity from recent days
  const activityDir = join(workspacePath, 'activity');
  if (!existsSync(activityDir)) return;

  const allEntries: Array<{
    timestamp: string;
    app_name: string;
    window_title: string;
    url?: string;
    screenshot_path?: string;
  }> = [];

  const now = new Date();
  for (let i = 0; i < daysWindow; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dbPath = join(activityDir, `${dateStr}.db`);

    if (existsSync(dbPath)) {
      const db = new ActivityDB(dbPath);
      const entries = db.getAll();
      allEntries.push(...entries);
      db.close();
    }
  }

  if (allEntries.length === 0) {
    console.log('No activity data to analyze.');
    return;
  }

  // Detect patterns
  const sequences = detector.detect(allEntries);
  console.log(`Found ${sequences.length} potential patterns.`);

  for (const sequence of sequences) {
    // Analyze with LLM
    const analysis = await analyzer.analyze(sequence);

    if (!analysis.isAutomatable) continue;
    if (store.exists(analysis.name)) continue;

    // Save pattern
    store.save(analysis, sequence);
    console.log(`New pattern saved: ${analysis.name}`);

    // Notify user
    const appNames = sequence.steps.map(s => s.app_name).join(' → ');
    await notifier.notify({
      title: 'Climpse: Pattern Detected',
      message: `I noticed you ${analysis.description.toLowerCase()}. Want me to handle this?`,
      actions: ['Yes', 'Not now', 'Never'],
      patternName: analysis.name,
    });
  }
}

main().catch(err => {
  console.error('Daemon failed:', err);
  process.exit(1);
});
