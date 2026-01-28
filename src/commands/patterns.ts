import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from '../wizard/workspace.js';

interface PatternsOptions {
  approve?: string;
  reject?: string;
}

export async function patternsCommand(options: PatternsOptions): Promise<void> {
  const config = loadConfig();
  if (!config?.workspace) {
    console.error('Climpse is not configured. Run `climpse setup` first.');
    process.exit(1);
  }

  const patternsDir = join(config.workspace, 'patterns');

  if (!existsSync(patternsDir)) {
    console.log('No patterns detected yet. Keep using your computer and Climpse will learn.');
    return;
  }

  if (options.approve) {
    await updatePatternStatus(patternsDir, options.approve, 'Approved');
    return;
  }

  if (options.reject) {
    await updatePatternStatus(patternsDir, options.reject, 'Rejected');
    return;
  }

  await listPatterns(patternsDir);
}

async function listPatterns(patternsDir: string): Promise<void> {
  let files: string[];
  try {
    files = await readdir(patternsDir);
  } catch {
    console.log('No patterns detected yet.');
    return;
  }

  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.log('No patterns detected yet. Keep using your computer and Climpse will learn.');
    return;
  }

  console.log('Learned Patterns:\n');

  for (const file of mdFiles) {
    const content = await readFile(join(patternsDir, file), 'utf-8');
    const name = file.replace('.md', '');
    const statusMatch = content.match(/## Status\n(.+)/);
    const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
    const confidenceMatch = content.match(/## Confidence\n(.+)/);
    const confidence = confidenceMatch ? confidenceMatch[1].trim() : 'Unknown';

    const statusIcon =
      status === 'Approved' ? '[active]' :
      status === 'Rejected' ? '[rejected]' :
      '[pending]';

    console.log(`  ${statusIcon} ${name}`);
    console.log(`     Confidence: ${confidence}`);
    console.log('');
  }

  console.log('Use `climpse patterns --approve <name>` to enable automation.');
}

async function updatePatternStatus(
  patternsDir: string,
  name: string,
  status: string
): Promise<void> {
  const filePath = join(patternsDir, `${name}.md`);

  if (!existsSync(filePath)) {
    console.error(`Pattern "${name}" not found.`);
    process.exit(1);
  }

  let content = await readFile(filePath, 'utf-8');
  content = content.replace(/## Status\n.+/, `## Status\n${status}`);
  await writeFile(filePath, content, 'utf-8');

  console.log(`Pattern "${name}" ${status.toLowerCase()}.`);
}
