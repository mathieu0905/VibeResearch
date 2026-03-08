import { PapersRepository } from '@db';
import type { TagCategory } from '@shared';
import { getSemanticSearchSettings } from '../store/app-settings-store';
import { localSemanticService } from './local-semantic.service';
import { cosineSimilarity } from './semantic-utils';

export interface SemanticSearchPaper {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  submittedAt?: string | null;
  tagNames?: string[];
  abstract?: string | null;
  relevanceReason?: string;
  similarityScore: number;
  matchedChunks: string[];
  processingStatus?: string;
}

export interface SemanticSearchResult {
  mode: 'semantic' | 'fallback';
  papers: SemanticSearchPaper[];
  fallbackReason?: string;
}

function mapPaper(chunkPaper: {
  id: string;
  shortId: string;
  title: string;
  authorsJson: string;
  submittedAt: Date | string | null;
  abstract: string | null;
  processingStatus: string;
  tags: Array<{ tag: { name: string; category: string } }>;
}) {
  return {
    id: chunkPaper.id,
    shortId: chunkPaper.shortId,
    title: chunkPaper.title,
    authors: JSON.parse(chunkPaper.authorsJson) as string[],
    submittedAt:
      typeof chunkPaper.submittedAt === 'string'
        ? chunkPaper.submittedAt
        : (chunkPaper.submittedAt?.toISOString() ?? null),
    abstract: chunkPaper.abstract,
    tagNames: chunkPaper.tags.map((item) => item.tag.name),
    categorizedTags: chunkPaper.tags.map((item) => ({
      name: item.tag.name,
      category: item.tag.category as TagCategory,
    })),
    processingStatus: chunkPaper.processingStatus,
  };
}

export class SemanticSearchService {
  private papersRepository = new PapersRepository();

  async search(query: string, limit = 20): Promise<SemanticSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { mode: 'semantic', papers: [] };
    }

    const settings = getSemanticSearchSettings();
    if (!settings.enabled) {
      return {
        mode: 'fallback',
        papers: [],
        fallbackReason: 'Local semantic search is disabled in Settings.',
      };
    }

    let queryEmbedding: number[];
    try {
      [queryEmbedding] = await localSemanticService.embedTexts([trimmed]);
    } catch (error) {
      return {
        mode: 'fallback',
        papers: [],
        fallbackReason:
          error instanceof Error ? error.message : 'Local semantic model is unavailable.',
      };
    }

    const chunks = await this.papersRepository.listChunksForSemanticSearch();
    if (chunks.length === 0) {
      return {
        mode: 'fallback',
        papers: [],
        fallbackReason: 'No semantic index is available yet. Papers are still processing.',
      };
    }

    const grouped = new Map<
      string,
      {
        paper: ReturnType<typeof mapPaper>;
        hits: Array<{ score: number; preview: string }>;
      }
    >();

    for (const chunk of chunks) {
      let embedding: number[];
      try {
        embedding = JSON.parse(chunk.embeddingJson) as number[];
      } catch {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, embedding);
      if (!Number.isFinite(score) || score <= 0) continue;

      const existing = grouped.get(chunk.paperId) ?? {
        paper: mapPaper(chunk.paper),
        hits: [],
      };
      existing.hits.push({ score, preview: chunk.contentPreview });
      grouped.set(chunk.paperId, existing);
    }

    const papers = Array.from(grouped.values())
      .map(({ paper, hits }) => {
        const topHits = hits.sort((a, b) => b.score - a.score).slice(0, 3);
        const weightedScore = topHits.reduce(
          (sum, hit, index) => sum + hit.score * [1, 0.85, 0.7][index],
          0,
        );
        return {
          ...paper,
          similarityScore: weightedScore,
          matchedChunks: topHits.map((hit) => hit.preview),
          relevanceReason: topHits[0]?.preview,
        } satisfies SemanticSearchPaper;
      })
      .sort((left, right) => right.similarityScore - left.similarityScore)
      .slice(0, limit);

    if (papers.length === 0) {
      return {
        mode: 'fallback',
        papers: [],
        fallbackReason:
          'Semantic search found no indexed matches, so normal search should be used.',
      };
    }

    return { mode: 'semantic', papers };
  }
}
