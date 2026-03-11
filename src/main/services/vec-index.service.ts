import { getVecStore, VecEntry } from '../../db/vec-store';

export interface VecSearchHit {
  chunkId: string;
  distance: number;
}

export interface VecIndexStatus {
  initialized: boolean;
  dimension: number | null;
  model: string | null;
  rowCount: number;
}

let currentDimension: number | null = null;
let currentModel: string | null = null;
let initialized = false;

function getStore() {
  return getVecStore();
}

export function initialize(dimension: number, model: string): void {
  const store = getStore();

  // Check if we need to rebuild
  const storedDim = store.getDimension();
  const storedModel = store.getModel();

  if (storedDim && storedDim !== dimension) {
    console.log(`[vec-index] Dimension changed ${storedDim} → ${dimension}, rebuilding vec table`);
    store.clear();
  }

  if (storedModel && storedModel !== model) {
    console.log(`[vec-index] Model changed ${storedModel} → ${model}, rebuilding vec table`);
    store.clear();
  }

  store.initialize(dimension, model);
  currentDimension = dimension;
  currentModel = model;
  initialized = true;
  console.log(`[vec-index] Initialized (dimension=${dimension}, model=${model})`);
}

export function isInitialized(): boolean {
  // Check store initialization state
  const store = getStore();
  return initialized && store.isInitialized();
}

export function syncChunksForPaper(
  paperId: string,
  chunks: Array<{ id: string; embedding: number[] }>,
): void {
  if (!initialized) return;

  const store = getStore();

  // Auto-detect dimension from first embedding if not yet set
  if (!currentDimension && chunks.length > 0) {
    const dim = chunks[0].embedding.length;
    if (dim > 0) {
      const model = store.getModel() || 'unknown';
      initialize(dim, model);
    }
  }

  // Delete existing chunks for this paper
  store.deleteByPaperId(paperId);

  // Insert new chunks
  const entries: VecEntry[] = chunks.map((chunk) => ({
    chunkId: chunk.id,
    embedding: new Float32Array(chunk.embedding),
  }));

  store.batchInsert(entries);
  store.save();
}

export function deleteChunksByPaperId(paperId: string): void {
  if (!initialized) return;
  const store = getStore();
  store.deleteByPaperId(paperId);
  store.save();
}

export function deleteChunksByIds(ids: string[]): void {
  if (!initialized || ids.length === 0) return;
  const store = getStore();
  store.deleteMany(ids);
  store.save();
}

export function searchKNN(queryEmbedding: number[], k: number): VecSearchHit[] {
  if (!initialized) return [];

  const store = getStore();
  const query = new Float32Array(queryEmbedding);
  return store.searchKNN(query, k);
}

export async function rebuildFromPrisma(): Promise<number> {
  const store = getStore();

  // Import prisma to query chunks
  const { getPrismaClient } = await import('@db');
  const prisma = getPrismaClient();

  const chunks = await prisma.paperChunk.findMany({
    select: { id: true, embeddingJson: true },
    orderBy: [{ paperId: 'asc' }, { chunkIndex: 'asc' }],
  });

  if (chunks.length === 0) return 0;

  // Detect dimension from first chunk
  const firstEmbedding = JSON.parse(chunks[0].embeddingJson) as number[];
  const dimension = firstEmbedding.length;
  if (dimension === 0) return 0;

  const model = store.getModel() || 'unknown';

  // Rebuild: clear and reinsert
  store.clear();
  store.initialize(dimension, model);

  const entries: VecEntry[] = [];
  for (const chunk of chunks) {
    try {
      const embedding = JSON.parse(chunk.embeddingJson) as number[];
      if (embedding.length !== dimension) continue;
      entries.push({
        chunkId: chunk.id,
        embedding: new Float32Array(embedding),
      });
    } catch {
      // Skip malformed embeddings
    }
  }

  // Batch insert
  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    store.batchInsert(batch);
  }

  store.save();
  currentDimension = dimension;
  currentModel = model;
  initialized = true;

  console.log(
    `[vec-index] Rebuilt index: ${entries.length}/${chunks.length} chunks (dimension=${dimension}, model=${model})`,
  );
  return entries.length;
}

export function getStatus(): VecIndexStatus {
  const store = getStore();

  if (!initialized || !store.isInitialized()) {
    return { initialized: false, dimension: null, model: null, rowCount: 0 };
  }

  return {
    initialized: true,
    dimension: currentDimension,
    model: currentModel,
    rowCount: store.getCount(),
  };
}

export function resetIndex(): void {
  const store = getStore();
  store.clear();
  store.initialize(0, '');
  currentDimension = null;
  currentModel = null;
  initialized = false;
  console.log('[vec-index] Index reset');
}

// Initialize on module load
const store = getStore();
if (store.isInitialized()) {
  currentDimension = store.getDimension();
  currentModel = store.getModel();
  initialized = true;
  console.log(`[vec-index] Restored from disk (dim=${currentDimension}, model=${currentModel})`);
}
