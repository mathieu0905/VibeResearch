import { safeStorage } from 'electron';
import fs from 'fs';
import { ensureStorageDir, getProviderConfigPath } from './storage-path';

export interface ProviderConfig {
  id: string; // 'anthropic' | 'openai' | 'gemini' | 'custom'
  name: string;
  apiKeyEncrypted?: string; // safeStorage encrypted, base64
  baseURL?: string;
  model: string;
  customHeaders?: Record<string, string>;
  enabled: boolean;
}

interface StoreData {
  providers: ProviderConfig[];
  activeProviderId: string;
}

const DEFAULT_DATA: StoreData = {
  providers: [
    { id: 'anthropic', name: 'Anthropic', model: 'claude-sonnet-4-6', enabled: false },
    { id: 'openai', name: 'OpenAI', model: 'gpt-4o', enabled: false },
    { id: 'gemini', name: 'Google Gemini', model: 'gemini-2.0-flash', enabled: false },
    { id: 'custom', name: 'Custom (OpenAI-compatible)', model: 'custom-model', enabled: false },
  ],
  activeProviderId: 'anthropic',
};

function getStorePath(): string {
  return getProviderConfigPath();
}

function readStore(): StoreData {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    return { ...DEFAULT_DATA, ...(JSON.parse(raw) as Partial<StoreData>) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function writeStore(data: StoreData): void {
  ensureStorageDir();
  const storePath = getStorePath();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getProviders(): ProviderConfig[] {
  return readStore().providers;
}

export function getActiveProviderId(): string {
  return readStore().activeProviderId;
}

export function setActiveProvider(id: string): void {
  const data = readStore();
  data.activeProviderId = id;
  writeStore(data);
}

export function saveProvider(
  config: Omit<ProviderConfig, 'apiKeyEncrypted'> & { apiKey?: string },
): void {
  const data = readStore();
  const idx = data.providers.findIndex((p) => p.id === config.id);
  const existing = idx >= 0 ? data.providers[idx] : undefined;

  const updated: ProviderConfig = {
    id: config.id,
    name: config.name,
    model: config.model,
    baseURL: config.baseURL,
    customHeaders: config.customHeaders,
    enabled: config.enabled,
    apiKeyEncrypted: existing?.apiKeyEncrypted,
  };

  if (config.apiKey) {
    if (safeStorage.isEncryptionAvailable()) {
      updated.apiKeyEncrypted = safeStorage.encryptString(config.apiKey).toString('base64');
    } else {
      // Fallback: plain base64 (not secure, but functional)
      updated.apiKeyEncrypted = Buffer.from(config.apiKey).toString('base64');
    }
  }

  if (idx >= 0) {
    data.providers[idx] = updated;
  } else {
    data.providers.push(updated);
  }

  writeStore(data);
}

export function getDecryptedApiKey(providerId: string): string | undefined {
  const providers = getProviders();
  const provider = providers.find((p) => p.id === providerId);
  if (!provider?.apiKeyEncrypted) return undefined;

  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(provider.apiKeyEncrypted, 'base64'));
    }
    return Buffer.from(provider.apiKeyEncrypted, 'base64').toString('utf-8');
  } catch {
    return undefined;
  }
}

export function getActiveProvider(): (ProviderConfig & { apiKey?: string }) | undefined {
  const data = readStore();
  const provider = data.providers.find((p) => p.id === data.activeProviderId && p.enabled);
  if (!provider) return undefined;
  return { ...provider, apiKey: getDecryptedApiKey(provider.id) };
}

export function getProviderById(id: string): (ProviderConfig & { apiKey?: string }) | undefined {
  const providers = getProviders();
  const provider = providers.find((p) => p.id === id && p.enabled);
  if (!provider) return undefined;
  return { ...provider, apiKey: getDecryptedApiKey(provider.id) };
}
