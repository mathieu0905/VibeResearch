import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * All Vibe Research data is stored under ~/.vibe-research/
 * This ensures easy backup and consistent access across app versions.
 * For testing, set VIBE_RESEARCH_STORAGE_DIR to use a custom directory.
 */
function getBaseDir(): string {
  if (process.env.VIBE_RESEARCH_STORAGE_DIR) {
    return process.env.VIBE_RESEARCH_STORAGE_DIR;
  }
  return path.join(os.homedir(), '.vibe-research');
}

export function getStorageDir(): string {
  return getBaseDir();
}

export function ensureStorageDir(): void {
  const baseDir = getBaseDir();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

export function getDbPath(): string {
  return path.join(getBaseDir(), 'vibe-research.db');
}

export function getProviderConfigPath(): string {
  return path.join(getBaseDir(), 'provider-config.json');
}

export function getAppSettingsPath(): string {
  return path.join(getBaseDir(), 'app-settings.json');
}

export function getCliToolsPath(): string {
  return path.join(getBaseDir(), 'cli-tools.json');
}

export function getPapersBaseDir(): string {
  return path.join(getBaseDir(), 'papers');
}
