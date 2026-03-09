/**
 * Citation extraction service.
 * Fetches references and citations from Semantic Scholar API,
 * then matches them to local papers in the library.
 */
import { proxyFetch } from './proxy-fetch';
import { CitationsRepository, type CreateCitationParams } from '@db';

const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1';

export class CitationExtractionError extends Error {
  retryable: boolean;
  status?: number;

  constructor(message: string, options?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = 'CitationExtractionError';
    this.retryable = options?.retryable ?? false;
    this.status = options?.status;
  }
}

interface S2Reference {
  paperId: string | null;
  title: string;
  authors?: Array<{ name: string }>;
  year?: number;
  externalIds?: Record<string, string>;
  contexts?: string[];
}

interface S2PaperCitations {
  references: S2Reference[];
  citations: S2Reference[];
}

function extractArxivId(paper: { shortId?: string; sourceUrl?: string | null }): string | null {
  if (paper.shortId && /^\d{4}\.\d{4,5}$/.test(paper.shortId)) {
    return paper.shortId;
  }
  if (paper.sourceUrl) {
    const match = paper.sourceUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^/?]+?)(?:\.pdf)?$/);
    if (match) return match[1].replace(/v\d+$/, '');
  }
  return null;
}

function isTitleSimilar(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const unionSize = new Set([...wordsA, ...wordsB]).size;
  return unionSize > 0 && intersection.length / unionSize > 0.6;
}

async function fetchS2Citations(s2PaperId: string): Promise<S2PaperCitations | null> {
  try {
    const fields = 'title,authors,year,externalIds,contexts';
    const res = await proxyFetch(
      `${S2_API_BASE}/paper/${s2PaperId}?fields=references,citations,references.${fields},citations.${fields}`,
      { timeoutMs: 15_000 },
    );
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new CitationExtractionError(
        `Semantic Scholar request failed with status ${res.status}`,
        { retryable, status: res.status },
      );
    }
    const json = JSON.parse(res.text());
    return {
      references: json.references ?? [],
      citations: json.citations ?? [],
    };
  } catch (error) {
    if (error instanceof CitationExtractionError) throw error;
    throw new CitationExtractionError('Semantic Scholar request failed', { retryable: true });
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function shouldFallbackToTitleSearch(error: unknown): boolean {
  return error instanceof CitationExtractionError && error.status === 404;
}

async function searchS2PaperIdByTitle(title: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(title);
    const res = await proxyFetch(
      `${S2_API_BASE}/paper/search?query=${query}&limit=1&fields=title`,
      { timeoutMs: 10_000 },
    );
    if (!res.ok) {
      throw new CitationExtractionError(
        `Semantic Scholar title search failed with status ${res.status}`,
        { retryable: isRetryableStatus(res.status), status: res.status },
      );
    }

    const json = JSON.parse(res.text());
    const first = json?.data?.[0];
    if (!first?.paperId) return null;

    if (!isTitleSimilar(title, first.title)) return null;
    return first.paperId;
  } catch (error) {
    if (error instanceof CitationExtractionError) throw error;
    throw new CitationExtractionError('Semantic Scholar title search failed', { retryable: true });
  }
}

async function resolveS2PaperId(paper: {
  shortId: string;
  title: string;
  sourceUrl?: string | null;
}): Promise<string | null> {
  const arxivId = extractArxivId(paper);
  if (arxivId) {
    return `ArXiv:${arxivId}`;
  }

  return searchS2PaperIdByTitle(paper.title);
}

async function fetchPaperCitationsWithFallback(paper: {
  shortId: string;
  title: string;
  sourceUrl?: string | null;
}): Promise<{ s2Id: string | null; data: S2PaperCitations | null }> {
  const primaryS2Id = await resolveS2PaperId(paper);
  if (!primaryS2Id) {
    return { s2Id: null, data: null };
  }

  try {
    const data = await fetchS2Citations(primaryS2Id);
    return { s2Id: primaryS2Id, data };
  } catch (error) {
    if (!extractArxivId(paper) || !shouldFallbackToTitleSearch(error)) {
      throw error;
    }

    const titleS2Id = await searchS2PaperIdByTitle(paper.title);
    if (!titleS2Id || titleS2Id === primaryS2Id) {
      throw error;
    }

    const data = await fetchS2Citations(titleS2Id);
    return { s2Id: titleS2Id, data };
  }
}

export class CitationExtractionService {
  private citationsRepo = new CitationsRepository();

  async extractForPaper(paper: {
    id: string;
    shortId: string;
    title: string;
    sourceUrl?: string | null;
  }): Promise<{ referencesFound: number; citationsFound: number; matched: number }> {
    const result = await fetchPaperCitationsWithFallback(paper);
    if (!result?.s2Id) {
      return { referencesFound: 0, citationsFound: 0, matched: 0 };
    }

    const data = result.data;
    if (!data) {
      return { referencesFound: 0, citationsFound: 0, matched: 0 };
    }

    // Get all local papers for matching
    const localPapers = await this.citationsRepo.getAllLocalPaperTitles();

    const citations: CreateCitationParams[] = [];
    let matched = 0;

    // Process references (papers this paper cites)
    for (const ref of data.references) {
      if (!ref.paperId && !ref.title) continue;

      const localMatch = this.findLocalMatch(ref, localPapers);
      if (localMatch) matched++;

      citations.push({
        sourcePaperId: paper.id,
        targetPaperId: localMatch?.id ?? null,
        externalTitle: ref.title,
        externalId: ref.paperId ?? `title:${ref.title}`,
        citationType: 'reference',
        context: ref.contexts?.[0] ?? null,
        confidence: localMatch ? 1.0 : 0.5,
      });
    }

    // Process citations (papers that cite this paper)
    for (const cit of data.citations) {
      if (!cit.paperId && !cit.title) continue;

      const localMatch = this.findLocalMatch(cit, localPapers);
      if (localMatch) matched++;

      // For citations, the citing paper is the source
      if (localMatch) {
        citations.push({
          sourcePaperId: localMatch.id,
          targetPaperId: paper.id,
          externalTitle: cit.title,
          externalId: cit.paperId ?? `title:${cit.title}`,
          citationType: 'reference',
          context: cit.contexts?.[0] ?? null,
          confidence: 1.0,
        });
      }
    }

    if (citations.length > 0) {
      await this.citationsRepo.createMany(citations);
    }

    return {
      referencesFound: data.references.length,
      citationsFound: data.citations.length,
      matched,
    };
  }

  async resolveUnmatched(): Promise<number> {
    const unresolved = await this.citationsRepo.findUnresolved();
    const localPapers = await this.citationsRepo.getAllLocalPaperTitles();
    let resolved = 0;

    for (const citation of unresolved) {
      if (!citation.externalTitle) continue;
      const match = localPapers.find((p) => isTitleSimilar(p.title, citation.externalTitle!));
      if (match) {
        await this.citationsRepo.resolveByTitle(citation.id, match.id);
        resolved++;
      }
    }

    return resolved;
  }

  private findLocalMatch(
    ref: S2Reference,
    localPapers: Array<{ id: string; title: string; shortId: string; sourceUrl: string | null }>,
  ): { id: string } | null {
    // Try matching by arXiv ID first
    const refArxivId = ref.externalIds?.ArXiv;
    if (refArxivId) {
      const match = localPapers.find(
        (p) => p.shortId === refArxivId || p.sourceUrl?.includes(refArxivId),
      );
      if (match) return { id: match.id };
    }

    // Try title matching
    if (ref.title) {
      const match = localPapers.find((p) => isTitleSimilar(p.title, ref.title));
      if (match) return { id: match.id };
    }

    return null;
  }
}
