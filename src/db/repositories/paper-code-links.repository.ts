import { getPrismaClient } from '../client';

export class PaperCodeLinksRepository {
  private prisma = getPrismaClient();

  async create(params: {
    paperId: string;
    repoUrl: string;
    commitHash?: string;
    confidence: number;
    source: string;
  }) {
    return this.prisma.paperCodeLink.create({
      data: params,
    });
  }
}
