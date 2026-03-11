import { getPrismaClient } from '../client';

export interface CreateChatSessionInput {
  projectId: string;
  title: string;
  paperIds?: string[];
  repoIds?: string[];
}

export interface CreateChatMessageInput {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
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

  // ── Messages ──────────────────────────────────────────────────────────────

  async addMessage(input: CreateChatMessageInput) {
    return this.prisma.chatMessage.create({
      data: input,
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
