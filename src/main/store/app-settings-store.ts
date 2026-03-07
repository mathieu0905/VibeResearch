import fs from 'fs';
import { ensureStorageDir, getAppSettingsPath, getPapersBaseDir } from './storage-path';

interface AppSettings {
  papersDir: string;
  editorCommand: string; // e.g. "code" or "cursor"
}

const DEFAULT_PAPERS_DIR = getPapersBaseDir();

function getSettingsPath(): string {
  return getAppSettingsPath();
}

function load(): AppSettings {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as AppSettings;
    }
  } catch {
    // ignore
  }
  return { papersDir: DEFAULT_PAPERS_DIR, editorCommand: 'code' };
}

function save(settings: AppSettings) {
  ensureStorageDir();
  const settingsPath = getSettingsPath();
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getAppSettings(): AppSettings {
  return load();
}

export function setPapersDir(dir: string) {
  const settings = load();
  settings.papersDir = dir;
  save(settings);
  process.env.VIBE_PAPERS_DIR = dir;
}

export function setEditorCommand(cmd: string) {
  const settings = load();
  settings.editorCommand = cmd;
  save(settings);
}

export function getEditorCommand(): string {
  return load().editorCommand ?? 'code';
}

export function getPapersDir(): string {
  const env = process.env.VIBE_PAPERS_DIR;
  if (env) return env;
  return load().papersDir;
}
