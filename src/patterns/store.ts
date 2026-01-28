import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { DetectedSequence } from './detector.js';
import type { PatternAnalysis } from './analyzer.js';

export interface StoredPattern {
  name: string;
  analysis: PatternAnalysis;
  sequence: DetectedSequence;
  status: 'Pending user approval' | 'Approved' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export class PatternStore {
  private patternsDir: string;

  constructor(workspacePath: string) {
    this.patternsDir = join(workspacePath, 'patterns');
    if (!existsSync(this.patternsDir)) {
      mkdirSync(this.patternsDir, { recursive: true });
    }
  }

  save(analysis: PatternAnalysis, sequence: DetectedSequence): void {
    const filePath = join(this.patternsDir, `${analysis.name}.md`);
    const now = new Date().toISOString();

    const markdown = this.toMarkdown(analysis, sequence);
    writeFileSync(filePath, markdown, 'utf-8');
  }

  exists(name: string): boolean {
    return existsSync(join(this.patternsDir, `${name}.md`));
  }

  load(name: string): StoredPattern | null {
    const filePath = join(this.patternsDir, `${name}.md`);
    if (!existsSync(filePath)) return null;

    const content = readFileSync(filePath, 'utf-8');
    return this.fromMarkdown(content, name);
  }

  getStatus(name: string): string | null {
    const pattern = this.load(name);
    return pattern?.status ?? null;
  }

  private toMarkdown(
    analysis: PatternAnalysis,
    sequence: DetectedSequence
  ): string {
    const steps = sequence.steps
      .map((s, i) => {
        let line = `${i + 1}. ${s.app_name}`;
        if (s.window_title) line += ` (${s.window_title})`;
        if (s.url) line += ` — ${s.url}`;
        return line;
      })
      .join('\n');

    const automationSteps = analysis.automationSteps
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');

    const daysSpan = Math.ceil(
      (new Date(sequence.lastSeen).getTime() - new Date(sequence.firstSeen).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return `# ${analysis.name}

## Observed
${analysis.description}

${steps}

Observed ${sequence.occurrences} times over ${daysSpan} days.
Usually between ${sequence.timeRange.start}-${sequence.timeRange.end}.

## Confidence
${analysis.confidence} (${analysis.summary})

## Automation
${automationSteps}

## Status
Pending user approval
`;
  }

  private fromMarkdown(content: string, name: string): StoredPattern {
    const statusMatch = content.match(/## Status\n(.+)/);
    const status = (statusMatch?.[1]?.trim() ?? 'Pending user approval') as StoredPattern['status'];

    const confidenceMatch = content.match(/## Confidence\n(.+)/);
    const confidence = confidenceMatch?.[1]?.trim() ?? 'Medium';

    return {
      name,
      analysis: {
        name,
        description: '',
        isAutomatable: true,
        confidence: confidence.split(' ')[0] as 'Low' | 'Medium' | 'High',
        automationSteps: [],
        summary: '',
      },
      sequence: {
        steps: [],
        occurrences: 0,
        averageTime: '',
        timeRange: { start: '', end: '' },
        firstSeen: '',
        lastSeen: '',
      },
      status,
      createdAt: '',
      updatedAt: '',
    };
  }
}
