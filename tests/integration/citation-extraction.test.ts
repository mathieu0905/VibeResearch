import { afterEach, describe, expect, it, vi } from 'vitest';

const proxyFetch = vi.fn();

vi.mock('../../src/main/services/proxy-fetch', () => ({
  proxyFetch,
}));

describe('citation extraction service', () => {
  afterEach(() => {
    proxyFetch.mockReset();
    vi.resetModules();
  });

  it('throws a retryable error on Semantic Scholar rate limiting', async () => {
    proxyFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: {},
      body: Buffer.from('{"message":"Too Many Requests"}'),
      text: () => '{"message":"Too Many Requests"}',
    });

    const { CitationExtractionService } =
      await import('../../src/main/services/citation-extraction.service');

    const service = new CitationExtractionService();

    await expect(
      service.extractForPaper({
        id: 'paper-1',
        shortId: '1706.03762',
        title: 'Attention Is All You Need',
        sourceUrl: 'https://arxiv.org/abs/1706.03762',
      }),
    ).rejects.toMatchObject({
      name: 'CitationExtractionError',
      retryable: true,
      status: 429,
    });
  });
});
