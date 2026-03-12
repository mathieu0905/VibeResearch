/**
 * Service for managing paper embeddings (title + abstract only)
 * Replaces the old chunk-based indexing system
 */

import { PapersRepository, PaperEmbeddingRepository } from '@db';
import { localSemanticService } from './local-semantic.service';
import * as vecIndex from './vec-index.service';

const papersRepository = new PapersRepository();
const paperEmbeddingRepository = new PaperEmbeddingRepository();

/**
 * Generate and store embeddings for a single paper
 */
export async function generateEmbeddings(paperId: string): Promise<void> {
  const paper = await papersRepository.findById(paperId);
  if (!paper) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  // Prepare texts to embed (title is required, abstract is optional)
  const texts = [paper.title];
  if (paper.abstract) {
    texts.push(paper.abstract);
  }

  // Generate embeddings using local semantic service
  const embeddings = await localSemanticService.embedTexts(texts);

  // Store to database
  await paperEmbeddingRepository.upsert({
    paperId,
    titleEmbedding: JSON.stringify(embeddings[0]),
    abstractEmbedding: paper.abstract ? JSON.stringify(embeddings[1]) : null,
  });

  // Sync to vector index
  await syncToVecStore(paperId, embeddings, paper.abstract !== null);
}

/**
 * Process pending papers that don't have embeddings yet
 * @param limit Maximum number of papers to process
 * @returns Number of papers processed
 */
export async function processPendingPapers(limit = 10): Promise<number> {
  const papers = await papersRepository.findPapersWithoutEmbeddings(limit);

  for (const paper of papers) {
    try {
      await generateEmbeddings(paper.id);
    } catch (error) {
      console.error(`[PaperEmbedding] Failed to generate embeddings for paper ${paper.id}:`, error);
    }
  }

  return papers.length;
}

/**
 * Rebuild all embeddings (for migration or re-indexing)
 * @returns Number of papers processed
 */
export async function rebuildAllEmbeddings(): Promise<number> {
  // Delete all existing embeddings
  await paperEmbeddingRepository.deleteAll();

  // Clear vector store
  vecIndex.clear();

  // Process all papers
  const papers = await papersRepository.list();
  let processed = 0;

  for (const paper of papers) {
    try {
      await generateEmbeddings(paper.id);
      processed++;
    } catch (error) {
      console.error(`[PaperEmbedding] Failed to rebuild embeddings for paper ${paper.id}:`, error);
    }
  }

  return processed;
}

/**
 * Delete embeddings for a paper
 */
export async function deleteEmbeddings(paperId: string): Promise<void> {
  await paperEmbeddingRepository.delete(paperId);
  await removeFromVecStore(paperId);
}

/**
 * Initialize vector store from database on startup
 */
export async function initializeVecStore(): Promise<void> {
  const embeddings = await paperEmbeddingRepository.listAll();

  for (const emb of embeddings) {
    if (emb.titleEmbedding) {
      const titleVec = JSON.parse(emb.titleEmbedding);
      vecIndex.upsert(`paper:${emb.paperId}:title`, new Float32Array(titleVec));
    }

    if (emb.abstractEmbedding) {
      const abstractVec = JSON.parse(emb.abstractEmbedding);
      vecIndex.upsert(`paper:${emb.paperId}:abstract`, new Float32Array(abstractVec));
    }
  }

  console.log(`[PaperEmbedding] Loaded ${embeddings.length} paper embeddings into vector store`);
}

/**
 * Get statistics about embeddings
 */
export async function getEmbeddingStats(): Promise<{
  totalPapers: number;
  papersWithEmbeddings: number;
  papersWithoutEmbeddings: number;
}> {
  const totalPapers = await papersRepository.count();
  const papersWithEmbeddings = await paperEmbeddingRepository.count();

  return {
    totalPapers,
    papersWithEmbeddings,
    papersWithoutEmbeddings: totalPapers - papersWithEmbeddings,
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Sync embeddings to vector index
 * Key format: paper:{paperId}:title or paper:{paperId}:abstract
 */
async function syncToVecStore(
  paperId: string,
  embeddings: number[][],
  hasAbstract: boolean,
): Promise<void> {
  // Store title embedding
  vecIndex.upsert(`paper:${paperId}:title`, new Float32Array(embeddings[0]));

  // Store abstract embedding if available
  if (hasAbstract && embeddings[1]) {
    vecIndex.upsert(`paper:${paperId}:abstract`, new Float32Array(embeddings[1]));
  }
}

/**
 * Remove paper vectors from vector index
 */
async function removeFromVecStore(paperId: string): Promise<void> {
  vecIndex.remove(`paper:${paperId}:title`);
  vecIndex.remove(`paper:${paperId}:abstract`);
}
