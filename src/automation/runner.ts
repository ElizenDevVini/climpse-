import { readFileSync } from 'fs';
import { join } from 'path';
import { BrowserAutomation } from './browser.js';
import { OSAutomation } from './os.js';

export interface AutomationStep {
  type: 'open_url' | 'open_app' | 'shell_command';
  value: string;
}

/**
 * Parses pattern markdown files and executes automation steps.
 */
export class AutomationRunner {
  private browser: BrowserAutomation;
  private os: OSAutomation;

  constructor() {
    this.browser = new BrowserAutomation();
    this.os = new OSAutomation();
  }

  async runPattern(workspacePath: string, patternName: string): Promise<void> {
    const filePath = join(workspacePath, 'patterns', `${patternName}.md`);
    const content = readFileSync(filePath, 'utf-8');
    const steps = this.parseSteps(content);

    console.log(`Running pattern: ${patternName} (${steps.length} steps)`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`  Step ${i + 1}: ${step.type} — ${step.value}`);

      try {
        await this.executeStep(step);
      } catch (err) {
        console.error(`  Step ${i + 1} failed: ${(err as Error).message}`);
      }

      // Brief delay between steps
      if (i < steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`Pattern "${patternName}" completed.`);
  }

  private parseSteps(markdown: string): AutomationStep[] {
    const automationSection = markdown.match(/## Automation\n([\s\S]*?)(?=\n## |$)/);
    if (!automationSection) return [];

    const lines = automationSection[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\d+\./.test(l));

    return lines.map(line => {
      const text = line.replace(/^\d+\.\s*/, '').trim();

      // Detect step type
      const urlMatch = text.match(/(?:open|visit|go to|navigate to)\s+(https?:\/\/\S+)/i);
      if (urlMatch) {
        return { type: 'open_url' as const, value: urlMatch[1] };
      }

      const appMatch = text.match(/(?:open|launch|start)\s+(.+)/i);
      if (appMatch) {
        return { type: 'open_app' as const, value: appMatch[1] };
      }

      // Default to shell command
      return { type: 'shell_command' as const, value: text };
    });
  }

  private async executeStep(step: AutomationStep): Promise<void> {
    switch (step.type) {
      case 'open_url':
        await this.browser.openUrl(step.value);
        break;
      case 'open_app':
        await this.os.openApp(step.value);
        break;
      case 'shell_command':
        await this.os.runShellCommand(step.value);
        break;
    }
  }
}
