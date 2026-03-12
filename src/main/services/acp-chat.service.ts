import { BrowserWindow } from 'electron';
import { ChatRepository, PapersRepository } from '@db';
import {
  generateWithModelKind,
  getLanguageModelFromConfig,
  streamText,
} from './ai-provider.service';
import { getActiveModel, getModelWithKey } from '../store/model-config-store';
import { AcpConnection } from '../agent/acp-connection';
import type { SessionUpdate } from '@agentclientprotocol/sdk';

interface AcpJobState {
  id: string;
  sessionId: string;
  chatSessionId: string;
  status: 'running' | 'completed' | 'failed';
  connection: AcpConnection | null;
  pendingPermission?: {
    requestId: number;
    resolve: (optionId: string) => void;
  };
}

/**
 * Unified chat service that supports both lightweight (direct LLM) and ACP modes.
 *
 * - Lightweight mode (backend=null): Direct streaming via Vercel AI SDK
 * - ACP mode (backend!=null): Full agent capabilities via ACP protocol
 */
export class AcpChatService {
  private repo = new ChatRepository();
  private papersRepo = new PapersRepository();
  private activeJobs = new Map<string, AcpJobState>();

  // ── Sessions ──────────────────────────────────────────────────────────────

  async createSession(input: {
    projectId: string;
    title: string;
    paperIds?: string[];
    repoIds?: string[];
    backend?: string | null;
    cwd?: string | null;
    sessionMode?: string | null;
  }) {
    return this.repo.createSession(input);
  }

  async getSession(id: string) {
    const session = await this.repo.getSession(id);
    if (!session) return null;
    return {
      ...session,
      paperIds: JSON.parse(session.paperIdsJson) as string[],
      repoIds: JSON.parse(session.repoIdsJson) as string[],
    };
  }

  async listSessionsByProject(projectId: string) {
    const sessions = await this.repo.listSessionsByProject(projectId);
    return sessions.map((s) => ({
      ...s,
      paperIds: JSON.parse(s.paperIdsJson) as string[],
      repoIds: JSON.parse(s.repoIdsJson) as string[],
    }));
  }

  async updateSessionTitle(id: string, title: string) {
    return this.repo.updateSessionTitle(id, title);
  }

  async deleteSession(id: string) {
    return this.repo.deleteSession(id);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async addMessage(input: {
    sessionId: string;
    role: string;
    content: string;
    metadataJson?: string;
  }) {
    return this.repo.addMessage(input);
  }

  async getMessagesBySession(sessionId: string) {
    return this.repo.getMessagesBySession(sessionId);
  }

  // ── Chat (Unified: Lightweight + ACP) ────────────────────────────────────

  async sendMessage(input: {
    chatSessionId: string;
    projectId: string;
    paperIds: string[];
    repoIds?: string[];
    prompt: string;
    backend?: string | null;
    cwd?: string;
  }): Promise<{ jobId: string; started: boolean }> {
    const jobId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const session = await this.repo.getSession(input.chatSessionId);
    if (!session) throw new Error('Chat session not found');

    const job: AcpJobState = {
      id: jobId,
      sessionId: '', // Will be set by ACP if needed
      chatSessionId: input.chatSessionId,
      status: 'running',
      connection: null,
    };
    this.activeJobs.set(jobId, job);

    // Route based on backend
    const backend = input.backend ?? session.backend;
    if (!backend || backend === 'lightweight') {
      // Lightweight mode: Direct LLM streaming (existing logic)
      this.runLightweightChat(job, input).catch((err) => {
        console.error('[AcpChatService] Lightweight chat error:', err);
        job.status = 'failed';
        this.broadcastError(jobId, err.message);
      });
    } else {
      // ACP mode: Spawn agent
      this.runAgentChat(job, input, backend).catch((err) => {
        console.error('[AcpChatService] Agent chat error:', err);
        job.status = 'failed';
        this.broadcastError(jobId, err.message);
      });
    }

    return { jobId, started: true };
  }

  private async runLightweightChat(
    job: AcpJobState,
    input: {
      chatSessionId: string;
      projectId: string;
      paperIds: string[];
      repoIds?: string[];
      prompt: string;
    },
  ) {
    // Fetch existing messages
    const existingMessages = await this.repo.getMessagesBySession(input.chatSessionId);
    const messageHistory = existingMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Fetch paper context
    const papers = await Promise.all(
      input.paperIds.map((id) => this.papersRepo.findById(id).catch(() => null)),
    );
    const validPapers = papers.filter(Boolean) as Awaited<
      ReturnType<PapersRepository['findById']>
    >[];

    const paperContext = validPapers
      .map((p) => {
        const parts = [`Title: ${p!.title}`];
        if (p!.abstract) parts.push(`Abstract: ${p!.abstract}`);
        return parts.join('\n');
      })
      .join('\n\n---\n\n');

    const modelConfig = getActiveModel('lightweight');
    if (!modelConfig) {
      throw new Error('No lightweight model configured. Please set up a model in Settings.');
    }
    const configWithKey = getModelWithKey(modelConfig.id);
    if (!configWithKey) throw new Error('Model config not found');
    const model = getLanguageModelFromConfig(configWithKey);

    const systemPrompt = [
      'You are a research ideation assistant helping researchers explore and develop novel research ideas.',
      'You engage in thoughtful, conversational dialogue to help the user brainstorm, refine, and deepen research directions.',
      'Draw on the provided papers context to ground your suggestions in concrete evidence.',
      'Ask clarifying questions, suggest connections between ideas, and help the user think through feasibility and novelty.',
      'Be concise but substantive. Respond in the same language as the user.',
    ].join(' ');

    const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (paperContext) {
      formattedMessages.push(
        {
          role: 'user',
          content: `${paperContext}\n\nI will discuss research ideas with you. Please be ready.`,
        },
        {
          role: 'assistant',
          content:
            "I understand the project context and the provided materials. I'm ready to help you explore and develop research ideas. What would you like to discuss?",
        },
      );
    }

    formattedMessages.push(...messageHistory);
    formattedMessages.push({ role: 'user', content: input.prompt });

    const { textStream } = streamText({
      model,
      system: systemPrompt,
      messages: formattedMessages,
      maxOutputTokens: 4096,
    });

    const msgId = `msg-${Date.now()}`;
    let fullText = '';

    for await (const chunk of textStream) {
      fullText += chunk;
      this.broadcastStream(job.id, {
        msgId,
        type: 'text',
        role: 'assistant',
        content: { text: chunk },
      });
    }

    // Save assistant message
    await this.repo.addMessage({
      sessionId: input.chatSessionId,
      role: 'assistant',
      content: fullText,
    });

    job.status = 'completed';
    this.broadcastStatus(job.id, 'completed');
  }

  private async runAgentChat(
    job: AcpJobState,
    input: {
      chatSessionId: string;
      projectId: string;
      paperIds: string[];
      repoIds?: string[];
      prompt: string;
      cwd?: string;
    },
    backend: string,
  ) {
    // TODO: Phase 3 will implement full ACP agent spawning
    // For now, this is a placeholder that will be filled in Phase 3
    throw new Error('ACP agent mode not yet implemented (Phase 3)');
  }

  // ── Job Control ───────────────────────────────────────────────────────────

  killJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    if (job.connection) {
      job.connection.kill();
    }
    job.status = 'failed';
    this.activeJobs.delete(jobId);
    return true;
  }

  getActiveJob(jobId: string): AcpJobState | null {
    return this.activeJobs.get(jobId) ?? null;
  }

  // ── Broadcasting ──────────────────────────────────────────────────────────

  private broadcastStream(jobId: string, update: SessionUpdate) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send('acp-chat:stream', jobId, update);
    });
  }

  private broadcastStatus(jobId: string, status: string) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send('acp-chat:status', jobId, status);
    });
  }

  private broadcastError(jobId: string, error: string) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send('acp-chat:error', jobId, error);
    });
  }

  // ── Title Generation ──────────────────────────────────────────────────────

  async generateTitleFromMessage(content: string): Promise<string> {
    const systemPrompt = [
      'You are a helpful assistant that generates short, concise titles for chat conversations.',
      'Given a user message, generate a title of maximum 6 words that summarizes the topic.',
      'Return ONLY the title text, no quotes, no explanation.',
    ].join(' ');

    try {
      const response = await generateWithModelKind(
        'lightweight',
        systemPrompt,
        `Generate a short title for this message: ${content.slice(0, 200)}`,
      );
      return response
        .trim()
        .replace(/^["']|["']$/g, '')
        .slice(0, 50);
    } catch {
      return 'New Chat';
    }
  }
}
