import { describe, expect, it, vi } from 'vitest';
import { generateShortId } from '../../src/shared/utils/short-id';

describe('generateShortId', () => {
  describe('arxiv ID extraction', () => {
    it('extracts arxiv ID from abs URL', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId('https://arxiv.org/abs/1706.03762', countLocalPapers);
      expect(shortId).toBe('1706.03762');
      expect(countLocalPapers).not.toHaveBeenCalled();
    });

    it('extracts arxiv ID from pdf URL', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId(
        'https://arxiv.org/pdf/2504.16054.pdf',
        countLocalPapers,
      );
      expect(shortId).toBe('2504.16054');
    });

    it('removes version suffix from arxiv ID', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId('https://arxiv.org/abs/1706.03762v1', countLocalPapers);
      expect(shortId).toBe('1706.03762');
    });

    it('extracts ID from URL with query parameters', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId(
        'https://arxiv.org/abs/1706.03762?foo=bar',
        countLocalPapers,
      );
      expect(shortId).toBe('1706.03762');
    });
  });

  describe('local ID generation', () => {
    it('generates local ID for non-arxiv URL', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(5);
      const shortId = await generateShortId('https://example.com/paper', countLocalPapers);
      expect(shortId).toBe('local-006');
      expect(countLocalPapers).toHaveBeenCalledOnce();
    });

    it('generates local ID for undefined sourceUrl', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId(undefined, countLocalPapers);
      expect(shortId).toBe('local-001');
    });

    it('generates local ID for null sourceUrl', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(10);
      const shortId = await generateShortId(null as unknown as undefined, countLocalPapers);
      expect(shortId).toBe('local-011');
    });

    it('pads local ID with leading zeros', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      expect(await generateShortId(undefined, countLocalPapers)).toBe('local-001');

      countLocalPapers.mockResolvedValue(9);
      expect(await generateShortId(undefined, countLocalPapers)).toBe('local-010');

      countLocalPapers.mockResolvedValue(99);
      expect(await generateShortId(undefined, countLocalPapers)).toBe('local-100');

      countLocalPapers.mockResolvedValue(999);
      expect(await generateShortId(undefined, countLocalPapers)).toBe('local-1000');
    });
  });

  describe('edge cases', () => {
    it('handles empty string URL', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      // Empty string is not a valid URL, so extractArxivId returns null
      const shortId = await generateShortId('', countLocalPapers);
      expect(shortId).toBe('local-001');
    });

    it('handles malformed URL', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(0);
      const shortId = await generateShortId('not-a-url', countLocalPapers);
      expect(shortId).toBe('local-001');
    });

    it('handles URL that looks like arxiv but is different domain', async () => {
      const countLocalPapers = vi.fn().mockResolvedValue(5);
      // extractArxivId only checks path structure, not hostname, so /abs/1706.03762
      // still matches and returns the arXiv ID even from a non-arxiv.org domain
      const shortId = await generateShortId(
        'https://fake-arxiv.org/abs/1706.03762',
        countLocalPapers,
      );
      expect(shortId).toBe('1706.03762');
    });
  });

  describe('async behavior', () => {
    it('awaits countLocalPapers for local ID', async () => {
      let resolveCount: (value: number) => void;
      const countPromise = new Promise<number>((resolve) => {
        resolveCount = resolve;
      });
      const countLocalPapers = vi.fn().mockReturnValue(countPromise);

      const shortIdPromise = generateShortId(undefined, countLocalPapers);

      // Promise should not resolve yet
      await Promise.resolve();
      expect(countLocalPapers).toHaveBeenCalled();

      // Now resolve the count
      resolveCount!(42);
      const shortId = await shortIdPromise;
      expect(shortId).toBe('local-043');
    });
  });
});
