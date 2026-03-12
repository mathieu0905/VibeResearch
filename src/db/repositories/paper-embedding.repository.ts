/**
 * Repository for PaperEmbedding operations
 */

import { getPrismaClient } from '../client';
import type { PaperEmbedding } from '@prisma/client';

export class PaperEmbeddingRepository {
  private prisma = getPrismaClient();

  /**
   * Upsert embeddings for a paper
   */
  async upsert(data: {
    paperId: string;
    titleEmbedding?: string | null;
    abstractEmbedding?: string | null;
  }): Promise<PaperEmbedding> {
    return this.prisma.paperEmbedding.upsert({
      where: { paperId: data.paperId },
      create: {
        paperId: data.paperId,
        titleEmbedding: data.titleEmbedding,
        abstractEmbedding: data.abstractEmbedding,
      },
      update: {
        titleEmbedding: data.titleEmbedding,
        abstractEmbedding: data.abstractEmbedding,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find embedding by paper ID
   */
  async findByPaperId(paperId: string): Promise<PaperEmbedding | null> {
    return this.prisma.paperEmbedding.findUnique({
      where: { paperId },
    });
  }

  /**
   * Delete embedding for a paper
   */
  async delete(paperId: string): Promise<void> {
    await this.prisma.paperEmbedding.delete({
      where: { paperId },
    });
  }

  /**
   * List all embeddings
   */
  async listAll(): Promise<PaperEmbedding[]> {
    return this.prisma.paperEmbedding.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count all embeddings
   */
  async count(): Promise<number> {
    return this.prisma.paperEmbedding.count();
  }

  /**
   * Delete all embeddings (for testing/rebuild)
   */
  async deleteAll(): Promise<number> {
    const result = await this.prisma.paperEmbedding.deleteMany({});
    return result.count;
  }
}
