import { getPrismaClient } from '../client';

export interface CreateChatSessionInput {
  projectId: string;
  title: string;
  paperIds?: string[];
  repoIds?: string[];
  backend?: string | null; // 'lightweight' | 'claude-code' | 'codex' | 'gemini' | 'opencode' | null
  cwd?: string | null;
  sessionMode?: string | null;
}

export interface CreateChatMessageInput {
  sessionId: string;
  role: string; // 'user' | 'assistant' | 'thought' | 'tool_call' | 'permission'
  content: string;
  metadataJson?: string;
}

export class ChatRepository {
  private prisma = getPrismaClient();

  // ── Sessions ──────────────────────────────────────────────────────────────

  async createSession(input: CreateChatSessionInput) {
    return this.prisma.chatSession.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        paperIdsJson: JSON.stringify(input.paperIds ?? []),
        repoIdsJson: JSON.stringify(input.repoIds ?? []),
        backend: input.backend ?? null,
        cwd: input.cwd ?? null,
        sessionMode: input.sessionMode ?? null,
      },
    });
  }

  async getSession(id: string) {
    return this.prisma.chatSession.findUnique({
      where: { id },
    });
  }

  async listSessionsByProject(projectId: string) {
    return this.prisma.chatSession.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateSessionTitle(id: string, title: string) {
    return this.prisma.chatSession.update({
      where: { id },
      data: { title, updatedAt: new Date() },
    });
  }

  async deleteSession(id: string) {
    return this.prisma.chatSession.delete({
      where: { id },
    });
  }

  async updateSessionAcpFields(
    id: string,
    fields: {
      acpSessionId?: string | null;
      currentModelId?: string | null;
      backend?: string | null;
    },
  ) {
    return this.prisma.chatSession.update({
      where: { id },
      data: { ...fields, updatedAt: new Date() },
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async addMessage(input: CreateChatMessageInput) {
    return this.prisma.chatMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        metadataJson: input.metadataJson ?? '{}',
      },
    });
  }

  async getMessagesBySession(sessionId: string) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteMessagesBySession(sessionId: string) {
    return this.prisma.chatMessage.deleteMany({
      where: { sessionId },
    });
  }
}
