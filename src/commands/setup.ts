import { runWizard } from '../wizard/index.js';

export async function setupCommand(): Promise<void> {
  await runWizard();
}
