import { extractArxivId } from './arxiv-extractor';

/**
 * Generate a short ID for a paper
 * - For arXiv papers: use the arXiv ID (e.g., "2504.16054")
 * - For non-arXiv papers: use "local-XXX" format
 */
export async function generateShortId(
  sourceUrl: string | undefined,
  countLocalPapers: () => Promise<number>,
): Promise<string> {
  // Try to extract arXiv ID from URL
  if (sourceUrl) {
    const arxivId = extractArxivId(sourceUrl);
    if (arxivId) {
      return arxivId;
    }
  }

  // Generate local ID
  const count = await countLocalPapers();
  const num = count + 1;
  return `local-${num.toString().padStart(3, '0')}`;
}
