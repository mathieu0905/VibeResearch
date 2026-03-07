import { ipcMain } from 'electron';
import {
  getModelConfigs,
  getActiveModelIds,
  getActiveModel,
  setActiveModel,
  saveModelConfig,
  deleteModelConfig,
  getDecryptedApiKey,
  type ModelConfig,
  type ModelKind,
} from '../store/model-config-store';
import { testApiConnection } from '../services/ai-provider.service';

export function setupModelsIpc() {
  ipcMain.handle('models:list', async () => {
    const models = getModelConfigs();
    // Return models with masked API keys
    return models.map((m) => ({
      ...m,
      apiKeyEncrypted: undefined,
      hasApiKey: !!m.apiKeyEncrypted,
    }));
  });

  ipcMain.handle('models:getActiveIds', async () => {
    return getActiveModelIds();
  });

  ipcMain.handle('models:getActive', async (_, kind: ModelKind) => {
    const model = getActiveModel(kind);
    if (!model) return null;
    return {
      ...model,
      apiKeyEncrypted: undefined,
      hasApiKey: !!model.apiKeyEncrypted,
    };
  });

  ipcMain.handle(
    'models:save',
    async (_, config: Omit<ModelConfig, 'apiKeyEncrypted'> & { apiKey?: string }) => {
      saveModelConfig(config);
      return { success: true };
    },
  );

  ipcMain.handle('models:delete', async (_, id: string) => {
    deleteModelConfig(id);
    return { success: true };
  });

  ipcMain.handle('models:setActive', async (_, kind: ModelKind, id: string) => {
    setActiveModel(kind, id);
    return { success: true };
  });

  ipcMain.handle('models:getApiKey', async (_, id: string) => {
    const key = getDecryptedApiKey(id);
    if (!key) return null;
    return key.slice(0, 8) + '...' + key.slice(-4);
  });

  ipcMain.handle(
    'models:testConnection',
    async (
      _,
      params: {
        provider: 'anthropic' | 'openai' | 'gemini' | 'custom';
        model: string;
        apiKey?: string;
        baseURL?: string;
      },
    ) => {
      return testApiConnection(params);
    },
  );

  // Test saved model connection by ID
  ipcMain.handle('models:testSavedConnection', async (_, id: string) => {
    const models = getModelConfigs();
    const model = models.find((m) => m.id === id);
    if (!model || model.backend !== 'api') {
      return { success: false, error: 'Model not found or not an API model' };
    }
    const apiKey = getDecryptedApiKey(id);
    return testApiConnection({
      provider: model.provider ?? 'openai',
      model: model.model ?? '',
      apiKey,
      baseURL: model.baseURL,
    });
  });
}
