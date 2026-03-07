import fs from 'fs';
import { ensureStorageDir, getCliToolsPath } from './storage-path';

export type ProviderKind = 'anthropic' | 'openai' | 'gemini' | 'custom';

export interface CliConfig {
  id: string; // uuid-ish
  name: string;
  command: string; // e.g. "claude --dangerously-skip-permissions"
  envVars: string; // e.g. "ANTHROPIC_API_KEY=sk-..."
  provider: ProviderKind;
  active: boolean;
}

interface StoreData {
  tools: CliConfig[];
}

function getStorePath(): string {
  return getCliToolsPath();
}

function readStore(): StoreData {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    return JSON.parse(raw) as StoreData;
  } catch {
    return { tools: [] };
  }
}

function writeStore(data: StoreData): void {
  ensureStorageDir();
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function getCliTools(): CliConfig[] {
  return readStore().tools;
}

export function saveCliTools(tools: CliConfig[]): void {
  writeStore({ tools });
}

export function getActiveCliTool(): CliConfig | undefined {
  const tools = getCliTools();
  return tools.find((t) => t.active);
}

export function setActiveCliTool(id: string): void {
  const tools = getCliTools();
  const updated = tools.map((t) => ({ ...t, active: t.id === id }));
  saveCliTools(updated);
}
