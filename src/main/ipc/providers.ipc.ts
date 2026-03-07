import { ipcMain, dialog } from 'electron';
import { exec } from 'child_process';
import {
  getProviders,
  saveProvider,
  getActiveProviderId,
  setActiveProvider,
  getDecryptedApiKey,
} from '../store/provider-store';
import {
  getAppSettings,
  setPapersDir,
  setEditorCommand,
  getEditorCommand,
} from '../store/app-settings-store';
import { getShellPath } from '../services/cli-runner.service';

export function setupProvidersIpc() {
  ipcMain.handle('providers:list', async () => {
    const providers = getProviders();
    // Return providers with masked API keys (just indicate if key is set)
    return providers.map((p) => ({
      ...p,
      hasApiKey: !!p.apiKeyEncrypted,
      apiKeyEncrypted: undefined,
    }));
  });

  ipcMain.handle(
    'providers:save',
    async (
      _,
      config: {
        id: string;
        name: string;
        model: string;
        apiKey?: string;
        baseURL?: string;
        customHeaders?: Record<string, string>;
        enabled: boolean;
      },
    ) => {
      saveProvider(config);
      return { success: true };
    },
  );

  ipcMain.handle('providers:getActive', async () => {
    return getActiveProviderId();
  });

  ipcMain.handle('providers:setActive', async (_, id: string) => {
    setActiveProvider(id);
    return { success: true };
  });

  ipcMain.handle('providers:getApiKey', async (_, providerId: string) => {
    const key = getDecryptedApiKey(providerId);
    if (!key) return null;
    return key.slice(0, 8) + '...' + key.slice(-4);
  });

  ipcMain.handle('settings:get', async () => {
    return getAppSettings();
  });

  ipcMain.handle('settings:setPapersDir', async (_, dir: string) => {
    setPapersDir(dir);
    return { success: true };
  });

  ipcMain.handle('settings:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Papers Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('settings:setEditor', async (_, cmd: string) => {
    setEditorCommand(cmd);
    return { success: true };
  });

  ipcMain.handle('shell:openInEditor', async (_, dirPath: string) => {
    const cmd = getEditorCommand();
    const env = { ...process.env, PATH: getShellPath() };
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      exec(`${cmd} "${dirPath}"`, { env }, (err) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true });
      });
    });
  });
}
