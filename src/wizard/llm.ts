import * as p from '@clack/prompts';

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'ollama';
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export async function configureLLM(): Promise<LLMConfig> {
  const provider = await p.select({
    message: 'Select your LLM provider',
    options: [
      { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'recommended' },
      { value: 'openai', label: 'OpenAI (GPT)' },
      { value: 'ollama', label: 'Local (Ollama)', hint: 'no API key needed' },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (provider === 'ollama') {
    const baseUrl = await p.text({
      message: 'Ollama URL',
      initialValue: 'http://localhost:11434',
    });

    if (p.isCancel(baseUrl)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const model = await p.text({
      message: 'Model name',
      initialValue: 'llama3.2',
    });

    if (p.isCancel(model)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    return {
      provider: 'ollama',
      model: model as string,
      baseUrl: baseUrl as string,
    };
  }

  const apiKey = await p.password({
    message: `Enter your ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key`,
  });

  if (p.isCancel(apiKey)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  const defaultModel = provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';

  const model = await p.text({
    message: 'Model to use',
    initialValue: defaultModel,
  });

  if (p.isCancel(model)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  return {
    provider: provider as 'anthropic' | 'openai',
    apiKey: apiKey as string,
    model: model as string,
  };
}
