import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDatabase, ensureTestDatabaseSchema, resetTestDatabase } from '../support/test-db';
import { PapersService } from '../../src/main/services/papers.service';

describe('ingest service integration', () => {
  ensureTestDatabaseSchema();

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('upserts papers from chrome history simulation', async () => {
    const service = new PapersService();

    const entries = [
      {
        title: 'Attention Is All You Need',
        url: 'https://arxiv.org/abs/1706.03762',
        tags: ['llm', 'transformer'],
      },
      {
        title: 'BERT: Pre-training of Deep Bidirectional Transformers',
        url: 'https://arxiv.org/abs/1810.04805',
        tags: ['llm', 'nlp'],
      },
      {
        title: 'GPT-3: Language Models are Few-Shot Learners',
        url: 'https://arxiv.org/abs/2005.14165',
        tags: ['llm'],
      },
    ];

    for (const entry of entries) {
      await service.upsertFromIngest({
        title: entry.title,
        source: 'arxiv',
        sourceUrl: entry.url,
        tags: entry.tags,
      });
    }

    const all = await service.list({});
    expect(all.length).toBe(3);

    // Upsert same paper again — should not duplicate
    await service.upsertFromIngest({
      title: 'Attention Is All You Need',
      source: 'arxiv',
      sourceUrl: 'https://arxiv.org/abs/1706.03762',
      tags: ['llm'],
    });

    const afterUpsert = await service.list({});
    expect(afterUpsert.length).toBe(3);
  });
});
