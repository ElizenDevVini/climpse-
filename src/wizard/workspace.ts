import * as p from '@clack/prompts';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { LLMConfig } from './llm.js';
import type { MessagingConfig } from '../messaging/index.js';

export interface ClimpseConfig {
  llm: LLMConfig;
  workspace: string;
  installDate: string;
  observerInterval: number;
  screenshotOnAppSwitch: boolean;
  screenshotInterval: number;
  patternThreshold: number;
  patternDaysWindow: number;
  messaging?: MessagingConfig;
}

export function getConfigDir(): string {
  return join(homedir(), '.climpse');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function loadConfig(): ClimpseConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ClimpseConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: ClimpseConfig): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export async function setupWorkspace(): Promise<string> {
  const defaultWorkspace = join(homedir(), 'climpse');

  const workspace = await p.text({
    message: 'Workspace directory',
    initialValue: defaultWorkspace,
    validate(value) {
      if (!value) return 'Workspace directory is required';
      return undefined;
    },
  });

  if (p.isCancel(workspace)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  const workspacePath = workspace as string;

  // Create workspace directories
  const dirs = [
    workspacePath,
    join(workspacePath, 'activity'),
    join(workspacePath, 'activity', 'screenshots'),
    join(workspacePath, 'patterns'),
    join(workspacePath, 'memory'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create default config.yaml in workspace
  const configYamlPath = join(workspacePath, 'config.yaml');
  if (!existsSync(configYamlPath)) {
    writeFileSync(
      configYamlPath,
      [
        '# Climpse Workspace Configuration',
        '',
        '# How often to poll for active window (ms)',
        'observer_interval: 3000',
        '',
        '# Screenshot settings',
        'screenshot_on_app_switch: true',
        'screenshot_interval: 30000',
        '',
        '# Pattern detection',
        'pattern_threshold: 3  # minimum repetitions to detect',
        'pattern_days_window: 7  # days of history to analyze',
        '',
        '# Automation',
        'auto_approve: false  # require manual approval',
        '',
      ].join('\n'),
      'utf-8'
    );
  }

  // Create habits.md template
  const habitsPath = join(workspacePath, 'memory', 'habits.md');
  if (!existsSync(habitsPath)) {
    writeFileSync(
      habitsPath,
      [
        '# User Habits',
        '',
        '> This file is maintained by Climpse to track long-term observations.',
        '> It is updated periodically as new patterns emerge.',
        '',
        '## Observations',
        '',
        '_No observations yet. Climpse is still learning._',
        '',
      ].join('\n'),
      'utf-8'
    );
  }

  p.log.success(`Workspace created at ${workspacePath}`);
  return workspacePath;
}
