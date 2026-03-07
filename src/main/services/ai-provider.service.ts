import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  generateText,
  streamText,
  type LanguageModelV1,
  type TextPart,
  type ImagePart,
  type FilePart,
} from 'ai';

// Type alias for content parts (ai package doesn't export ContentPart directly)
type ContentPart = TextPart | ImagePart | FilePart;
import { getActiveProvider, getProviderById, type ProviderConfig } from '../store/provider-store';
import {
  getActiveModel,
  getModelWithKey,
  type ModelConfig,
  type ModelKind,
} from '../store/model-config-store';
import fs from 'fs/promises';
import path from 'path';

export function getLanguageModel(config: ProviderConfig & { apiKey?: string }): LanguageModelV1 {
  const { id, apiKey, baseURL, model } = config;

  switch (id) {
    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
        baseURL,
      });
      return provider(model);
    }
    case 'openai': {
      const provider = createOpenAI({
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
        baseURL,
      });
      return provider(model);
    }
    case 'gemini': {
      const provider = createGoogleGenerativeAI({
        apiKey: apiKey ?? process.env.GOOGLE_API_KEY,
        baseURL,
      });
      return provider(model);
    }
    case 'custom': {
      const provider = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL,
      });
      return provider(model);
    }
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

export async function fileToDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
  };

  const mimeType = mimeTypes[ext] ?? 'application/octet-stream';
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export function providerSupportsFiles(providerId: string): boolean {
  return ['anthropic', 'openai', 'gemini'].includes(providerId);
}

async function buildContentParts(
  text: string,
  files: Array<{ path: string; type?: 'pdf' | 'image' }>,
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [{ type: 'text', text }];

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file.path);
    const ext = path.extname(file.path).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) || file.type === 'image') {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          type: 'image',
          image: Buffer.from(match[2], 'base64'),
          mimeType: match[1],
        } as ImagePart);
      }
    } else {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          type: 'file',
          data: Buffer.from(match[2], 'base64'),
          mimeType: match[1],
        } as unknown as FilePart);
      }
    }
  }

  return parts;
}

export async function generateWithActiveProvider(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const config = getActiveProvider();

  if (!config) {
    return generateWithFallback(systemPrompt, userPrompt);
  }

  const model = getLanguageModel(config);
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4096,
  });

  return result.text;
}

export async function generateWithFiles(
  systemPrompt: string,
  userPrompt: string,
  files: Array<{ path: string; type?: 'pdf' | 'image' }>,
): Promise<string> {
  const config = getActiveProvider();
  if (!config) {
    throw new Error('No AI provider configured. Please set up a provider in Settings.');
  }

  if (!providerSupportsFiles(config.id)) {
    throw new Error(`Provider ${config.id} does not support file uploads.`);
  }

  const model = getLanguageModel(config);
  const contentParts = await buildContentParts(userPrompt, files);

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: contentParts }],
    maxTokens: 4096,
  });

  return result.text;
}

export async function generateWithProvider(
  providerId: string,
  systemPrompt: string,
  userPrompt: string,
  files?: Array<{ path: string; type?: 'pdf' | 'image' }>,
): Promise<string> {
  const config = getProviderById(providerId);

  if (!config || !config.enabled) {
    throw new Error(`Provider ${providerId} is not configured or enabled.`);
  }

  const model = getLanguageModel(config);

  if (files && files.length > 0) {
    if (!providerSupportsFiles(config.id)) {
      throw new Error(`Provider ${config.id} does not support file uploads.`);
    }
    const contentParts = await buildContentParts(userPrompt, files);
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentParts }],
      maxTokens: 4096,
    });
    return result.text;
  }

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4096,
  });

  return result.text;
}

async function generateWithFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (anthropicKey) {
    const provider = createAnthropic({ apiKey: anthropicKey });
    const model = provider(process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6');
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4096,
    });
    return result.text;
  }

  throw new Error('No AI provider configured. Please set up a provider in Settings.');
}

export function getLanguageModelFromConfig(
  config: ModelConfig & { apiKey?: string },
): LanguageModelV1 {
  const { provider, model, baseURL, apiKey } = config;

  if (!model) {
    throw new Error('Model ID is required in model config');
  }

  switch (provider) {
    case 'anthropic': {
      const p = createAnthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY, baseURL });
      return p(model);
    }
    case 'openai': {
      const p = createOpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY, baseURL });
      return p(model);
    }
    case 'gemini': {
      const p = createGoogleGenerativeAI({ apiKey: apiKey ?? process.env.GOOGLE_API_KEY, baseURL });
      return p(model);
    }
    case 'custom': {
      const p = createOpenAI({ apiKey: apiKey ?? '', baseURL });
      return p(model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function generateWithModelKind(
  kind: ModelKind,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const modelConfig = getActiveModel(kind);

  if (modelConfig && modelConfig.backend === 'api') {
    const configWithKey = getModelWithKey(modelConfig.id);
    if (configWithKey && configWithKey.apiKey) {
      const model = getLanguageModelFromConfig(configWithKey);
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: kind === 'lightweight' ? 1024 : 4096,
      });
      return result.text;
    }
  }

  return generateWithActiveProvider(systemPrompt, userPrompt);
}

export { streamText, getActiveProvider };

/**
 * Test API connection for a given provider config
 */
export async function testApiConnection(params: {
  provider: 'anthropic' | 'openai' | 'gemini' | 'custom';
  model: string;
  apiKey?: string;
  baseURL?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { provider, model, apiKey, baseURL } = params;

  if (!model) {
    return { success: false, error: 'Model ID is required' };
  }

  try {
    let languageModel: LanguageModelV1;

    switch (provider) {
      case 'anthropic': {
        const p = createAnthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY, baseURL });
        languageModel = p(model);
        break;
      }
      case 'openai': {
        const p = createOpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY, baseURL });
        languageModel = p(model);
        break;
      }
      case 'gemini': {
        const p = createGoogleGenerativeAI({
          apiKey: apiKey ?? process.env.GOOGLE_API_KEY,
          baseURL,
        });
        languageModel = p(model);
        break;
      }
      case 'custom': {
        if (!baseURL) {
          return { success: false, error: 'Base URL is required for custom provider' };
        }
        const p = createOpenAI({ apiKey: apiKey ?? '', baseURL });
        languageModel = p(model);
        break;
      }
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }

    // Send a minimal test request
    await generateText({
      model: languageModel,
      prompt: 'Say "ok" and nothing else.',
      maxTokens: 5,
    });

    // If we get any response, the connection is valid
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
