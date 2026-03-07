import type { SourceType } from '@shared';
import { getPrismaClient } from '../client';

export interface CreatePaperParams {
  shortId: string;
  title: string;
  authors: string[];
  source: SourceType;
  sourceUrl?: string;
  year?: number | null;
  abstract?: string;
  pdfUrl?: string;
  pdfPath?: string;
  tags: string[];
}

export class PapersRepository {
  private prisma = getPrismaClient();

  async create(params: CreatePaperParams) {
    const tags = await Promise.all(
      params.tags.map((name: string) =>
        this.prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        }),
      ),
    );

    const created = await this.prisma.paper.create({
      data: {
        shortId: params.shortId,
        title: params.title,
        authorsJson: JSON.stringify(params.authors),
        source: params.source,
        sourceUrl: params.sourceUrl,
        year: params.year,
        abstract: params.abstract,
        pdfUrl: params.pdfUrl,
        pdfPath: params.pdfPath,
        tags: {
          create: tags.map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    return {
      ...created,
      authors: JSON.parse(created.authorsJson) as string[],
      tagNames: created.tags.map((item) => item.tag.name),
    };
  }

  async list(query?: {
    q?: string;
    year?: number;
    tag?: string;
    importedWithin?: 'today' | 'week' | 'month' | 'all';
  }) {
    const conditions: Record<string, unknown>[] = [];

    // Title-only filter for Prisma query (tag matching done post-query)
    if (query?.q && !query.tag && !query.year) {
      // When only q is provided, fetch all and filter in JS for tag matching
    } else if (query?.q) {
      conditions.push({ title: { contains: query.q } });
    }

    if (query?.year) {
      conditions.push({ year: query.year });
    }

    if (query?.tag) {
      conditions.push({ tags: { some: { tag: { name: query.tag } } } });
    }

    // Import time filter
    if (query?.importedWithin && query.importedWithin !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (query.importedWithin) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        default:
          startDate = new Date(0);
      }
      conditions.push({ createdAt: { gte: startDate } });
    }

    const papers = await this.prisma.paper.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      include: {
        tags: { include: { tag: true } },
        links: true,
        readingNotes: true,
      },
      orderBy: [{ lastReadAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });

    const mapped = papers.map((paper) => ({
      ...paper,
      authors: JSON.parse(paper.authorsJson) as string[],
      tagNames: paper.tags.map((item) => item.tag.name),
    }));

    // Post-query filtering: match q against both title and tag names
    if (query?.q) {
      const q = query.q.toLowerCase();
      return mapped.filter(
        (paper) =>
          paper.title.toLowerCase().includes(q) ||
          paper.tagNames.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return mapped;
  }

  async findById(id: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        links: true,
        readingNotes: true,
      },
    });

    if (!paper) {
      return null;
    }

    return {
      ...paper,
      authors: JSON.parse(paper.authorsJson) as string[],
      tagNames: paper.tags.map((item) => item.tag.name),
    };
  }

  async findByShortId(shortId: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { shortId },
      include: {
        tags: { include: { tag: true } },
        links: true,
        readingNotes: true,
      },
    });

    if (!paper) {
      return null;
    }

    return {
      ...paper,
      authors: JSON.parse(paper.authorsJson) as string[],
      tagNames: paper.tags.map((item) => item.tag.name),
    };
  }

  async updatePdfPath(id: string, pdfPath: string) {
    return this.prisma.paper.update({
      where: { id },
      data: { pdfPath },
    });
  }

  async updateTags(id: string, tagNames: string[]) {
    // First, get or create all tags
    const tags = await Promise.all(
      tagNames.map((name) =>
        this.prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        }),
      ),
    );

    // Delete existing paper-tag relations
    await this.prisma.paperTag.deleteMany({
      where: { paperId: id },
    });

    // Create new paper-tag relations
    if (tags.length > 0) {
      await this.prisma.paperTag.createMany({
        data: tags.map((tag) => ({
          paperId: id,
          tagId: tag.id,
        })),
      });
    }

    // Return updated paper with tags
    return this.findById(id);
  }

  async listAllTags(): Promise<string[]> {
    const tags = await this.prisma.tag.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return tags.map((t) => t.name);
  }

  async touchLastRead(id: string) {
    return this.prisma.paper.update({
      where: { id },
      data: { lastReadAt: new Date() },
    });
  }

  async updateTitle(id: string, title: string) {
    return this.prisma.paper.update({
      where: { id },
      data: { title },
    });
  }

  async updateRating(id: string, rating: number | null) {
    const updated = await this.prisma.paper.update({
      where: { id },
      data: { rating },
      include: {
        tags: { include: { tag: true } },
      },
    });
    return {
      ...updated,
      authors: JSON.parse(updated.authorsJson) as string[],
      tagNames: updated.tags.map((item) => item.tag.name),
    };
  }

  async updateMetadata(id: string, data: { authors?: string[]; abstract?: string; year?: number }) {
    const updateData: Record<string, unknown> = {};
    if (data.authors !== undefined) {
      updateData.authorsJson = JSON.stringify(data.authors);
    }
    if (data.abstract !== undefined) {
      updateData.abstract = data.abstract;
    }
    if (data.year !== undefined) {
      updateData.year = data.year;
    }

    const updated = await this.prisma.paper.update({
      where: { id },
      data: updateData,
      include: {
        tags: { include: { tag: true } },
      },
    });
    return {
      ...updated,
      authors: JSON.parse(updated.authorsJson) as string[],
      tagNames: updated.tags.map((item) => item.tag.name),
    };
  }

  async listAll() {
    const papers = await this.prisma.paper.findMany({
      select: { id: true, shortId: true, title: true, sourceUrl: true },
    });
    return papers;
  }

  async listAllShortIds(): Promise<Set<string>> {
    const papers = await this.prisma.paper.findMany({
      select: { shortId: true },
    });
    return new Set(papers.map((p) => p.shortId));
  }

  async delete(id: string) {
    return this.prisma.paper.delete({
      where: { id },
    });
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;

    // Use transaction for atomic delete
    // Prisma's deleteMany doesn't cascade, so we need to delete related records first
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete related records in order
      await tx.readingNote.deleteMany({
        where: { paperId: { in: ids } },
      });
      await tx.paperTag.deleteMany({
        where: { paperId: { in: ids } },
      });
      await tx.sourceEvent.deleteMany({
        where: { paperId: { in: ids } },
      });
      await tx.paperCodeLink.deleteMany({
        where: { paperId: { in: ids } },
      });

      return tx.paper.deleteMany({
        where: { id: { in: ids } },
      });
    });

    return result.count;
  }

  async countByShortIdPrefix(prefix: string): Promise<number> {
    const count = await this.prisma.paper.count({
      where: {
        shortId: { startsWith: prefix },
      },
    });
    return count;
  }

  async updateTextPath(id: string, textPath: string) {
    return this.prisma.paper.update({
      where: { id },
      data: { textPath },
    });
  }

  async listToday() {
    // Get start of today in local timezone
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTimestamp = startOfToday.getTime();

    // Use raw query since SQLite stores timestamps as integers
    const papers = await this.prisma.$queryRaw<
      Array<{
        id: string;
        shortId: string;
        title: string;
        authorsJson: string;
        source: 'chrome' | 'manual' | 'arxiv';
        sourceUrl: string | null;
        year: number | null;
        abstract: string | null;
        pdfUrl: string | null;
        pdfPath: string | null;
        createdAt: Date;
        updatedAt: Date;
        lastReadAt: Date | null;
      }>
    >`
      SELECT * FROM Paper WHERE createdAt >= ${startTimestamp} ORDER BY createdAt DESC
    `;

    // Fetch tags for each paper
    const paperIds = papers.map((p) => p.id);
    const paperTags = await this.prisma.paperTag.findMany({
      where: { paperId: { in: paperIds } },
      include: { tag: true },
    });

    const tagMap = new Map<string, string[]>();
    for (const pt of paperTags) {
      const existing = tagMap.get(pt.paperId) || [];
      existing.push(pt.tag.name);
      tagMap.set(pt.paperId, existing);
    }

    return papers.map((paper) => ({
      ...paper,
      authors: JSON.parse(paper.authorsJson) as string[],
      tagNames: tagMap.get(paper.id) || [],
    }));
  }
}
