import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  normalizeWhitespace,
  splitTextIntoChunks,
} from '../../src/main/services/semantic-utils';

describe('semantic utils', () => {
  it('normalizes whitespace and chunks long text with previews', () => {
    const text = [
      'Introduction\n\nThis paper studies semantic retrieval across academic documents.',
      'Method\n\nWe build overlapping chunks so search can match concepts beyond titles.',
      'Results\n\nThe system improves recall for meaning-based queries over long PDFs.',
    ].join('\n\n');

    const chunks = splitTextIntoChunks(text.repeat(18), {
      chunkSize: 240,
      overlap: 40,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks.every((chunk) => chunk.contentPreview.length <= 240)).toBe(true);
    expect(normalizeWhitespace('a\n\n  b\t c')).toBe('a b c');
  });

  it('computes cosine similarity and guards invalid inputs', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([1, 2], [1])).toBe(-1);
    expect(cosineSimilarity([], [])).toBe(-1);
  });
});
