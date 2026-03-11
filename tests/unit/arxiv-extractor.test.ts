import { describe, expect, it } from 'vitest';
import {
  extractArxivId,
  extractArxivIdFromTitle,
  arxivPdfUrl,
  cleanArxivTitle,
  isInvalidTitle,
} from '../../src/shared/utils/arxiv-extractor';

describe('extractArxivId', () => {
  describe('abs URL format', () => {
    it('extracts ID from /abs/ format', () => {
      expect(extractArxivId('https://arxiv.org/abs/1706.03762')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/abs/2504.16054')).toBe('2504.16054');
    });

    it('removes version suffix from abs URL', () => {
      expect(extractArxivId('https://arxiv.org/abs/1706.03762v1')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/abs/2504.16054v2')).toBe('2504.16054');
      expect(extractArxivId('https://arxiv.org/abs/1234.56789v10')).toBe('1234.56789');
    });

    it('handles old format with archive prefix', () => {
      // Old format like /abs/cs.AI/0701001 — the regex only matches the last path segment,
      // so /abs/cs.AI/0701001 does not match /abs/([^/?]+)$; returns null
      expect(extractArxivId('https://arxiv.org/abs/cs.AI/0701001')).toBeNull();
    });
  });

  describe('pdf URL format', () => {
    it('extracts ID from /pdf/ format without extension', () => {
      expect(extractArxivId('https://arxiv.org/pdf/1706.03762')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/pdf/2504.16054')).toBe('2504.16054');
    });

    it('extracts ID from /pdf/ format with .pdf extension', () => {
      expect(extractArxivId('https://arxiv.org/pdf/1706.03762.pdf')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/pdf/2504.16054.pdf')).toBe('2504.16054');
    });

    it('removes version suffix from pdf URL', () => {
      expect(extractArxivId('https://arxiv.org/pdf/1706.03762v1')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/pdf/1706.03762v2.pdf')).toBe('1706.03762');
    });

    it('handles old format pdf URLs', () => {
      // Old format like /pdf/cs.AI/0701001
      expect(extractArxivId('https://arxiv.org/pdf/cs.AI/0701001')).toBe('cs.AI0701001');
      expect(extractArxivId('https://arxiv.org/pdf/hep-th/9901001')).toBe('hep-th9901001');
    });
  });

  describe('edge cases', () => {
    it('returns null for non-arxiv URLs', () => {
      expect(extractArxivId('https://example.com/paper')).toBeNull();
      expect(extractArxivId('https://google.com')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(extractArxivId('not-a-url')).toBeNull();
      expect(extractArxivId('')).toBeNull();
      expect(extractArxivId('arxiv.org/abs/1234')).toBeNull(); // Missing protocol
    });

    it('returns null for arxiv URLs without ID', () => {
      expect(extractArxivId('https://arxiv.org/')).toBeNull();
      expect(extractArxivId('https://arxiv.org/abs/')).toBeNull();
      expect(extractArxivId('https://arxiv.org/pdf/')).toBeNull();
    });

    it('handles URLs with query parameters', () => {
      expect(extractArxivId('https://arxiv.org/abs/1706.03762?foo=bar')).toBe('1706.03762');
      expect(extractArxivId('https://arxiv.org/pdf/1706.03762.pdf?download=1')).toBe('1706.03762');
    });
  });
});

describe('extractArxivIdFromTitle', () => {
  it('extracts arxiv ID from title containing arxiv.org URL', () => {
    expect(extractArxivIdFromTitle('arxiv.org/abs/1706.03762')).toBe('1706.03762');
    expect(extractArxivIdFromTitle('arxiv.org/pdf/2504.16054')).toBe('2504.16054');
  });

  it('removes version suffix', () => {
    expect(extractArxivIdFromTitle('arxiv.org/abs/1706.03762v1')).toBe('1706.03762');
    expect(extractArxivIdFromTitle('arxiv.org/pdf/2504.16054v2.pdf')).toBe('2504.16054');
  });

  it('handles case insensitivity', () => {
    expect(extractArxivIdFromTitle('ARXIV.ORG/abs/1706.03762')).toBe('1706.03762');
    expect(extractArxivIdFromTitle('ArXiv.org/PDF/2504.16054')).toBe('2504.16054');
  });

  it('returns null for titles without arxiv references', () => {
    expect(extractArxivIdFromTitle('A Great Paper Title')).toBeNull();
    expect(extractArxivIdFromTitle('')).toBeNull();
  });

  it('extracts ID from longer title context', () => {
    expect(
      extractArxivIdFromTitle('Great paper at arxiv.org/abs/1706.03762 about transformers'),
    ).toBe('1706.03762');
  });
});

describe('arxivPdfUrl', () => {
  it('generates canonical PDF URL', () => {
    expect(arxivPdfUrl('1706.03762')).toBe('https://arxiv.org/pdf/1706.03762');
    expect(arxivPdfUrl('2504.16054')).toBe('https://arxiv.org/pdf/2504.16054');
  });

  it('handles IDs with version suffix', () => {
    // The function just wraps the ID, it doesn't modify it
    expect(arxivPdfUrl('1706.03762v1')).toBe('https://arxiv.org/pdf/1706.03762v1');
  });
});

describe('cleanArxivTitle', () => {
  it('removes [arxiv ID] prefix from title', () => {
    expect(cleanArxivTitle('[2505.02833] Transformer Models')).toBe('Transformer Models');
    expect(cleanArxivTitle('[cs.CL/0701001] NLP Paper')).toBe('NLP Paper');
  });

  it('removes version suffix from ID prefix', () => {
    expect(cleanArxivTitle('[1706.03762v1] Attention Paper')).toBe('Attention Paper');
  });

  it('handles whitespace after bracket', () => {
    expect(cleanArxivTitle('[2505.02833]   Multiple Spaces')).toBe('Multiple Spaces');
  });

  it('returns original title if no bracket prefix', () => {
    expect(cleanArxivTitle('Normal Paper Title')).toBe('Normal Paper Title');
  });

  it('returns original title if bracket content is empty result', () => {
    // If the title becomes empty after removing prefix, return original
    expect(cleanArxivTitle('[2505.02833]')).toBe('[2505.02833]');
  });

  it('handles titles with brackets in middle', () => {
    // Only removes leading bracket prefix
    expect(cleanArxivTitle('Paper [Important] Note')).toBe('Paper [Important] Note');
  });
});

describe('isInvalidTitle', () => {
  describe('empty or whitespace', () => {
    it('returns true for empty string', () => {
      expect(isInvalidTitle('')).toBe(true);
    });

    it('returns true for whitespace only', () => {
      expect(isInvalidTitle('   ')).toBe(true);
      expect(isInvalidTitle('\t\n')).toBe(true);
    });
  });

  describe('URL format', () => {
    it('returns true for http URLs', () => {
      expect(isInvalidTitle('http://example.com/paper')).toBe(true);
    });

    it('returns true for https URLs', () => {
      expect(isInvalidTitle('https://arxiv.org/abs/1706.03762')).toBe(true);
    });
  });

  describe('arxiv path format', () => {
    it('returns true for arxiv.org/abs path', () => {
      expect(isInvalidTitle('arxiv.org/abs/1706.03762')).toBe(true);
    });

    it('returns true for arxiv.org/pdf path', () => {
      expect(isInvalidTitle('arxiv.org/pdf/1706.03762')).toBe(true);
    });

    it('handles case insensitivity', () => {
      expect(isInvalidTitle('ARXIV.ORG/abs/1706.03762')).toBe(true);
    });
  });

  describe('arxiv ID only', () => {
    it('returns true for new format arxiv ID', () => {
      expect(isInvalidTitle('1706.03762')).toBe(true);
      expect(isInvalidTitle('2504.16054')).toBe(true);
    });

    it('returns true for arxiv ID with version', () => {
      expect(isInvalidTitle('1706.03762v1')).toBe(true);
      expect(isInvalidTitle('2504.16054v2')).toBe(true);
    });

    it('returns true for 5-digit suffix ID', () => {
      expect(isInvalidTitle('1234.56789')).toBe(true);
    });
  });

  describe('valid titles', () => {
    it('returns false for normal paper titles', () => {
      expect(isInvalidTitle('Attention Is All You Need')).toBe(false);
      expect(isInvalidTitle('BERT: Pre-training of Deep Bidirectional Transformers')).toBe(false);
    });

    it('returns false for titles with numbers that are not arxiv IDs', () => {
      expect(isInvalidTitle('GPT-4 Technical Report')).toBe(false);
      expect(isInvalidTitle('Language Models are 10x Better')).toBe(false);
    });

    it('returns false for titles with special characters', () => {
      expect(isInvalidTitle('Deep Learning: A [Survey]')).toBe(false);
      expect(isInvalidTitle('Machine Learning & AI')).toBe(false);
    });
  });
});
