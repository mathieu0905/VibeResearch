import fs from 'fs';
import {
  ensureStorageDir,
  getAppSettingsPath,
  getPapersBaseDir,
  getStorageDir,
} from './storage-path';

export interface ProxyScope {
  pdfDownload: boolean; // PDF downloads from arxiv etc.
  aiApi: boolean; // AI API calls (Anthropic, OpenAI, Gemini)
  cliTools: boolean; // CLI tools (claude, codex, gemini)
}

interface AppSettings {
  papersDir?: string; // legacy field — ignored, papers are always at {storageRoot}/papers
  editorCommand: string; // e.g. "code" or "cursor"
  proxy?: string; // HTTP/SOCKS proxy URL, e.g. "http://127.0.0.1:7890" or "socks5://127.0.0.1:1080"
  proxyScope?: ProxyScope; // Where to use the proxy
  tagMigrationV1Done?: boolean;
}

const DEFAULT_PROXY_SCOPE: ProxyScope = {
  pdfDownload: true,
  aiApi: true,
  cliTools: true,
};

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
  return { editorCommand: 'code', proxy: undefined };
}

function save(settings: AppSettings) {
  ensureStorageDir();
  const settingsPath = getSettingsPath();
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getAppSettings(): AppSettings {
  return load();
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
  return getPapersBaseDir();
}

export function getProxy(): string | undefined {
  return load().proxy;
}

export function setProxy(proxy: string | undefined) {
  const settings = load();
  settings.proxy = proxy;
  save(settings);
}

export function getProxyScope(): ProxyScope {
  const settings = load();
  return { ...DEFAULT_PROXY_SCOPE, ...settings.proxyScope };
}

export function setProxyScope(scope: ProxyScope) {
  const settings = load();
  settings.proxyScope = scope;
  save(settings);
}

export function getStorageRoot(): string {
  return getStorageDir();
}

export function setTagMigrationDone() {
  const settings = load();
  (settings as unknown as Record<string, unknown>).tagMigrationV1Done = true;
  save(settings);
}

export function isTagMigrationDone(): boolean {
  return !!(load() as unknown as Record<string, unknown>).tagMigrationV1Done;
}
