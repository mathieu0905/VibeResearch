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
  setPapersDir,
  setEditorCommand,
  getEditorCommand,
  getProxy,
  setProxy,
  getProxyScope,
  setProxyScope,
  getSemanticSearchSettings,
  setSemanticSearchSettings,
  getStorageRoot as getStorageRootPath,
  type ProxyScope,
  type SemanticSearchSettings,
} from '../store/app-settings-store';
import { testProxy as runTestProxy, type ProxyTestResult } from './proxy-test.service';
import { localSemanticService } from './local-semantic.service';
import { warmupOllamaService } from './ollama.service';

export interface SemanticEmbeddingTestResult {
  success: boolean;
  model: string;
  baseUrl: string;
  dimensions: number;
  elapsedMs: number;
  startedOllama: boolean;
  preview: number[];
}

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

  setPapersDir(dir: string): { success: boolean } {
    setPapersDir(dir);
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

  getSemanticSearchSettings(): SemanticSearchSettings {
    return getSemanticSearchSettings();
  }

  setSemanticSearchSettings(settings: Partial<SemanticSearchSettings>): { success: boolean } {
    setSemanticSearchSettings(settings);
    return { success: true };
  }

  async testSemanticEmbedding(
    settingsOverrides: Partial<SemanticSearchSettings> = {},
  ): Promise<SemanticEmbeddingTestResult> {
    const settings = {
      ...getSemanticSearchSettings(),
      ...settingsOverrides,
    };
    const startedAt = Date.now();
    const startedOllama = await warmupOllamaService('settings-test-embedding', settings);
    const [embedding] = await localSemanticService.embedTexts(
      ['Vibe Research semantic embedding test.'],
      settings,
    );

    if (!embedding?.length) {
      throw new Error('Embedding model returned an empty vector.');
    }

    return {
      success: true,
      model: settings.embeddingModel,
      baseUrl: settings.baseUrl,
      dimensions: embedding.length,
      elapsedMs: Date.now() - startedAt,
      startedOllama,
      preview: embedding.slice(0, 5),
    };
  }
}

export const providersService = new ProvidersService();
