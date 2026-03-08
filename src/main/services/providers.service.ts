import {
  getProviders,
  saveProvider,
  getActiveProviderId,
  setActiveProvider,
  getDecryptedApiKey,
  type ProviderConfig,
} from '../store/provider-store';
import {
  getAppSettings,
  setEditorCommand,
  getEditorCommand,
  getProxy,
  setProxy,
  getProxyScope,
  setProxyScope,
  getStorageRoot as getStorageRootPath,
  type ProxyScope,
} from '../store/app-settings-store';
import {
  getStorageDir,
  setStorageDir as writeStorageDir,
  migrateStorageDir,
} from '../store/storage-path';
import { testProxy as runTestProxy, type ProxyTestResult } from './proxy-test.service';

export class ProvidersService {
  listProviders(): (ProviderConfig & { hasApiKey: boolean })[] {
    const providers = getProviders();
    return providers.map((p) => ({
      ...p,
      hasApiKey: !!p.apiKeyEncrypted,
      apiKeyEncrypted: undefined,
    }));
  }

  save(config: Omit<ProviderConfig, 'apiKeyEncrypted'> & { apiKey?: string }): {
    success: boolean;
  } {
    saveProvider(config);
    return { success: true };
  }

  getActiveId(): string {
    return getActiveProviderId();
  }

  setActive(id: string): { success: boolean } {
    setActiveProvider(id);
    return { success: true };
  }

  getMaskedApiKey(providerId: string): string | null {
    const key = getDecryptedApiKey(providerId);
    if (!key) return null;
    return key.slice(0, 8) + '...' + key.slice(-4);
  }

  getSettings() {
    return getAppSettings();
  }

  setStorageDir(newDir: string): { success: boolean; error?: string } {
    const oldDir = getStorageDir();
    if (oldDir === newDir) return { success: true };
    const result = migrateStorageDir(oldDir, newDir);
    if (!result.success) return result;
    writeStorageDir(newDir);
    return { success: true };
  }

  setEditor(cmd: string): { success: boolean } {
    setEditorCommand(cmd);
    return { success: true };
  }

  getEditor(): string {
    return getEditorCommand();
  }

  setProxy(proxy: string | undefined): { success: boolean } {
    setProxy(proxy || undefined);
    return { success: true };
  }

  getProxyUrl(): string | undefined {
    return getProxy();
  }

  getProxyScopeSettings(): ProxyScope {
    return getProxyScope();
  }

  setProxyScopeSettings(scope: ProxyScope): { success: boolean } {
    setProxyScope(scope);
    return { success: true };
  }

  async testProxy(proxyUrl?: string): Promise<{ hasProxy: boolean; results: ProxyTestResult[] }> {
    return runTestProxy(proxyUrl);
  }

  getStorageRoot(): string {
    return getStorageRootPath();
  }
}

export const providersService = new ProvidersService();
