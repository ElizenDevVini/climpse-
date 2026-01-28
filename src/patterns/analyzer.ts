import type { DetectedSequence } from './detector.js';
import type { LLMConfig } from '../wizard/llm.js';

export interface PatternAnalysis {
  name: string;
  description: string;
  isAutomatable: boolean;
  confidence: 'Low' | 'Medium' | 'High';
  automationSteps: string[];
  summary: string;
}

export class PatternAnalyzer {
  private llmConfig: LLMConfig;

  constructor(llmConfig: LLMConfig) {
    this.llmConfig = llmConfig;
  }

  async analyze(sequence: DetectedSequence): Promise<PatternAnalysis> {
    const prompt = this.buildPrompt(sequence);

    try {
      const response = await this.callLLM(prompt);
      return this.parseResponse(response, sequence);
    } catch (err) {
      console.error('LLM analysis failed:', (err as Error).message);
      return this.fallbackAnalysis(sequence);
    }
  }

  private buildPrompt(sequence: DetectedSequence): string {
    const steps = sequence.steps
      .map((s, i) => `${i + 1}. ${s.app_name}${s.window_title ? ` (${s.window_title})` : ''}${s.url ? ` — ${s.url}` : ''}`)
      .join('\n');

    return `I observed a user doing the following sequence ${sequence.occurrences} times over the past week:

${steps}

This usually happens around ${sequence.averageTime} (range: ${sequence.timeRange.start} to ${sequence.timeRange.end}).

Please analyze this pattern and respond in the following JSON format:
{
  "name": "short-kebab-case-name",
  "description": "One sentence description of the workflow",
  "isAutomatable": true/false,
  "confidence": "Low" | "Medium" | "High",
  "automationSteps": ["Step 1 description", "Step 2 description"],
  "summary": "Brief paragraph explaining the pattern and automation potential"
}

Only respond with valid JSON, no other text.`;
  }

  private async callLLM(prompt: string): Promise<string> {
    if (this.llmConfig.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    } else if (this.llmConfig.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.llmConfig.provider === 'ollama') {
      return this.callOllama(prompt);
    }
    throw new Error(`Unknown LLM provider: ${this.llmConfig.provider}`);
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.llmConfig.apiKey });

    const message = await client.messages.create({
      model: this.llmConfig.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.llmConfig.apiKey });

    const response = await client.chat.completions.create({
      model: this.llmConfig.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  private async callOllama(prompt: string): Promise<string> {
    const baseUrl = this.llmConfig.baseUrl ?? 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.llmConfig.model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }

  private parseResponse(response: string, sequence: DetectedSequence): PatternAnalysis {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr) as PatternAnalysis;

      // Validate required fields
      return {
        name: parsed.name || this.generateName(sequence),
        description: parsed.description || 'Detected workflow pattern',
        isAutomatable: parsed.isAutomatable ?? true,
        confidence: parsed.confidence || 'Medium',
        automationSteps: parsed.automationSteps || [],
        summary: parsed.summary || '',
      };
    } catch {
      return this.fallbackAnalysis(sequence);
    }
  }

  private fallbackAnalysis(sequence: DetectedSequence): PatternAnalysis {
    const name = this.generateName(sequence);
    const appNames = sequence.steps.map(s => s.app_name);

    return {
      name,
      description: `Open ${appNames.join(', ')} in sequence`,
      isAutomatable: true,
      confidence: sequence.occurrences >= 5 ? 'High' : 'Medium',
      automationSteps: sequence.steps.map(s => {
        if (s.url) return `Open ${s.url}`;
        return `Open ${s.app_name}`;
      }),
      summary: `User opens ${appNames.join(' → ')} in sequence, observed ${sequence.occurrences} times. Usually around ${sequence.averageTime}.`,
    };
  }

  private generateName(sequence: DetectedSequence): string {
    const apps = sequence.steps
      .map(s => s.app_name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .slice(0, 3);

    const hour = parseInt(sequence.averageTime.split(':')[0], 10);
    const timeOfDay =
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    return `${timeOfDay}-${apps.join('-')}`;
  }
}
