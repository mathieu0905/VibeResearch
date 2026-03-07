import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AgentToolKind, ModelConfig } from '../store/model-config-store';

export interface AgentConfigFileStatus {
  label: string;
  path: string;
  exists: boolean;
}

export interface AgentConfigStatus {
  tool: AgentToolKind;
  files: AgentConfigFileStatus[];
  missingRequired: boolean;
}

export interface AgentConfigContents {
  tool: AgentToolKind;
  configContent?: string;
  authContent?: string;
}

export function getSystemAgentConfigStatus(tool: AgentToolKind): AgentConfigStatus {
  const home = os.homedir();

  if (tool === 'claude-code') {
    const settingsPath = path.join(home, '.claude', 'settings.json');
    const exists = fs.existsSync(settingsPath);
    return {
      tool,
      files: [{ label: 'Claude settings', path: settingsPath, exists }],
      missingRequired: !exists,
    };
  }

  if (tool === 'codex') {
    const configPath = path.join(home, '.codex', 'config.toml');
    const authPath = path.join(home, '.codex', 'auth.json');
    const configExists = fs.existsSync(configPath);
    const authExists = fs.existsSync(authPath);
    return {
      tool,
      files: [
        { label: 'Codex config', path: configPath, exists: configExists },
        { label: 'Codex auth', path: authPath, exists: authExists },
      ],
      missingRequired: !configExists || !authExists,
    };
  }

  return { tool, files: [], missingRequired: false };
}

export function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function getMissingAgentConfigMessage(
  model: Pick<ModelConfig, 'agentTool' | 'configContent' | 'authContent'>,
): string | null {
  const tool = model.agentTool;
  if (!tool || tool === 'custom') return null;

  const status = getSystemAgentConfigStatus(tool);

  if (tool === 'claude-code') {
    const hasInlineSettings = !!model.configContent?.trim();
    const systemSettings = status.files[0];
    if (!hasInlineSettings && !systemSettings?.exists) {
      return `Claude Code needs either app-managed settings or ${systemSettings?.path ?? '~/.claude/settings.json'}.`;
    }
    return null;
  }

  if (tool === 'codex') {
    const systemConfig = status.files.find((file) => file.path.endsWith('config.toml'));
    const systemAuth = status.files.find((file) => file.path.endsWith('auth.json'));
    const missing: string[] = [];

    if (!model.configContent?.trim() && !systemConfig?.exists) {
      missing.push(systemConfig?.path ?? '~/.codex/config.toml');
    }
    if (!model.authContent?.trim() && !systemAuth?.exists) {
      missing.push(systemAuth?.path ?? '~/.codex/auth.json');
    }

    if (missing.length > 0) {
      return `Codex needs ${missing.join(' and ')} unless you paste the matching content into Settings.`;
    }
  }

  return null;
}

export function resolveAgentHomeFiles(
  model: Pick<ModelConfig, 'agentTool' | 'configContent' | 'authContent'>,
): Array<{ relativePath: string; content: string }> {
  const tool = model.agentTool;
  if (!tool || tool === 'custom') return [];

  const files: Array<{ relativePath: string; content: string }> = [];
  const status = getSystemAgentConfigStatus(tool);

  if (tool === 'claude-code') {
    const systemSettings = status.files[0];
    const settingsContent =
      model.configContent?.trim() ||
      (systemSettings?.exists ? readIfExists(systemSettings.path) : '');
    if (settingsContent) {
      files.push({ relativePath: '.claude/settings.json', content: settingsContent });
    }
    return files;
  }

  if (tool === 'codex') {
    const systemConfig = status.files.find((file) => file.path.endsWith('config.toml'));
    const systemAuth = status.files.find((file) => file.path.endsWith('auth.json'));
    const configContent =
      model.configContent?.trim() || (systemConfig?.exists ? readIfExists(systemConfig.path) : '');
    const authContent =
      model.authContent?.trim() || (systemAuth?.exists ? readIfExists(systemAuth.path) : '');

    if (configContent) files.push({ relativePath: '.codex/config.toml', content: configContent });
    if (authContent) files.push({ relativePath: '.codex/auth.json', content: authContent });
  }

  return files;
}

export function getSystemAgentConfigContents(tool: AgentToolKind): AgentConfigContents {
  const status = getSystemAgentConfigStatus(tool);

  if (tool === 'claude-code') {
    const settings = status.files[0];
    return {
      tool,
      configContent: settings?.exists ? readIfExists(settings.path) : undefined,
    };
  }

  if (tool === 'codex') {
    const configFile = status.files.find((file) => file.path.endsWith('config.toml'));
    const authFile = status.files.find((file) => file.path.endsWith('auth.json'));
    return {
      tool,
      configContent: configFile?.exists ? readIfExists(configFile.path) : undefined,
      authContent: authFile?.exists ? readIfExists(authFile.path) : undefined,
    };
  }

  return { tool };
}
