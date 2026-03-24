import { PapersRepository, ReadingRepository } from '@db';
import { getSemanticSearchSettings } from '../store/app-settings-store';
import { ReadingService } from './reading.service';
import { tagPaper, inferTitleAndAbstractFromExcerpt } from './tagging.service';
import { getPaperExcerptCached } from './paper-text.service';
import { BrowserWindow } from 'electron';

const AUTO_ENRICH_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.VIBE_AUTO_ENRICH_CONCURRENCY ?? '8', 10) || 8,
);

const queue: string[] = [];
const queuedIds = new Set<string>();
const inFlightIds = new Set<string>();
let activeWorkers = 0;

// Metadata extraction state
let metadataExtractionActive = false;
let metadataExtractionProgress = { total: 0, completed: 0 };

function shouldSkipAutomaticEnrichment() {
  return process.env.VITEST === 'true' && process.env.VIBE_ENABLE_AUTO_ENRICH_IN_TESTS !== '1';
}

function broadcastMetadataExtractionStatus() {
  const wins = BrowserWindow ? BrowserWindow.getAllWindows() : [];
  for (const win of wins) {
    win.webContents.send('metadata:extractionStatus', {
      active: metadataExtractionActive,
      ...metadataExtractionProgress,
    });
  }
}

function broadcastEnrichingPaper(paperId: string, active: boolean) {
  const wins = BrowserWindow ? BrowserWindow.getAllWindows() : [];
  for (const win of wins) {
    win.webContents.send('enrichment:paperStatus', { paperId, active });
  }
}

async function enrichPaper(paperId: string) {
  inFlightIds.add(paperId);
  broadcastEnrichingPaper(paperId, true);

  try {
    const papersRepository = new PapersRepository();
    const readingRepository = new ReadingRepository();
    const readingService = new ReadingService();

    const paper = await papersRepository.findById(paperId);
    if (!paper) return;

    const existingNotes = await readingRepository.listByPaper(paperId);
    const hasAnalysis = existingNotes.some((note) => note.title.startsWith('Analysis:'));

    if (!hasAnalysis) {
      try {
        await readingService.analyzePaper(
          {
            paperId,
            pdfUrl: paper.pdfUrl ?? undefined,
          },
          () => undefined,
          undefined,
          () => undefined,
        );
      } catch (error) {
        console.error('[auto-enrich] Analysis failed:', paperId, error);
      }
    }

    if (!paper.tagNames?.length) {
      try {
        await tagPaper(paperId, { managedStatus: false });
      } catch (error) {
        console.error('[auto-enrich] Auto tag failed:', paperId, error);
      }
    }
  } finally {
    inFlightIds.delete(paperId);
    broadcastEnrichingPaper(paperId, false);
  }
}

async function drainQueue() {
  while (activeWorkers < AUTO_ENRICH_CONCURRENCY && queue.length > 0) {
    activeWorkers += 1;
    void (async () => {
      try {
        while (queue.length > 0) {
          const paperId = queue.shift();
          if (!paperId) continue;
          queuedIds.delete(paperId);
          await enrichPaper(paperId);
        }
      } finally {
        activeWorkers -= 1;
        if (queue.length > 0) {
          void drainQueue();
        }
      }
    })();
  }
}

export function scheduleAutoPaperEnrichment(paperId: string) {
  if (shouldSkipAutomaticEnrichment()) return;
  const settings = getSemanticSearchSettings();
  if (!settings.autoEnrich) return;
  if (queuedIds.has(paperId) || inFlightIds.has(paperId)) return;
  queuedIds.add(paperId);
  queue.push(paperId);
  void drainQueue();
}

/**
 * Batch extract title and abstract from PDFs for papers that are missing them.
 * This runs with concurrency of 8 to speed up processing.
 */
export async function extractMissingMetadata(): Promise<{ extracted: number; failed: number }> {
  if (metadataExtractionActive) {
    throw new Error('Metadata extraction already in progress');
  }

  const repo = new PapersRepository();
  const papersMissingAbstract = await repo.listPapersMissingAbstract();

  if (papersMissingAbstract.length === 0) {
    return { extracted: 0, failed: 0 };
  }

  metadataExtractionActive = true;
  metadataExtractionProgress = { total: papersMissingAbstract.length, completed: 0 };
  broadcastMetadataExtractionStatus();

  let extracted = 0;
  let failed = 0;
  let idx = 0;

  async function worker() {
    while (idx < papersMissingAbstract.length) {
      const paper = papersMissingAbstract[idx++];
      if (!paper) continue;

      try {
        // Get PDF excerpt
        const pdfExcerpt = await getPaperExcerptCached(
          paper.id,
          paper.shortId,
          paper.pdfUrl ?? undefined,
          paper.pdfPath ?? undefined,
          6000,
        );

        if (pdfExcerpt) {
          const inferred = inferTitleAndAbstractFromExcerpt(pdfExcerpt);
          if (inferred.abstract || inferred.title) {
            await repo.updateMetadata(paper.id, {
              ...(inferred.title ? { title: inferred.title } : {}),
              ...(inferred.abstract ? { abstract: inferred.abstract } : {}),
              metadataSource: 'pdf-extraction',
            });
            extracted++;
            console.log(`[metadata-extraction] Extracted metadata for: ${paper.title}`);
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        console.error('[metadata-extraction] Failed for:', paper.id, error);
        failed++;
      }

      metadataExtractionProgress.completed++;
      broadcastMetadataExtractionStatus();
    }
  }

  // Run with concurrency
  await Promise.all(
    Array.from({ length: Math.min(AUTO_ENRICH_CONCURRENCY, papersMissingAbstract.length) }, worker),
  );

  metadataExtractionActive = false;
  broadcastMetadataExtractionStatus();

  return { extracted, failed };
}

/**
 * Batch extract title and abstract from PDFs for ALL papers with PDFs.
 * This will re-extract even for papers that already have metadata.
 */
export async function extractAllMetadata(): Promise<{ extracted: number; failed: number }> {
  if (metadataExtractionActive) {
    throw new Error('Metadata extraction already in progress');
  }

  const repo = new PapersRepository();
  const papersWithPdf = await repo.listPapersWithPdf();

  if (papersWithPdf.length === 0) {
    return { extracted: 0, failed: 0 };
  }

  metadataExtractionActive = true;
  metadataExtractionProgress = { total: papersWithPdf.length, completed: 0 };
  broadcastMetadataExtractionStatus();

  let extracted = 0;
  let failed = 0;
  let idx = 0;

  async function worker() {
    while (idx < papersWithPdf.length) {
      const paper = papersWithPdf[idx++];
      if (!paper) continue;

      try {
        // Get PDF excerpt
        const pdfExcerpt = await getPaperExcerptCached(
          paper.id,
          paper.shortId,
          paper.pdfUrl ?? undefined,
          paper.pdfPath ?? undefined,
          6000,
        );

        if (pdfExcerpt) {
          const inferred = inferTitleAndAbstractFromExcerpt(pdfExcerpt);
          if (inferred.abstract || inferred.title) {
            await repo.updateMetadata(paper.id, {
              ...(inferred.title ? { title: inferred.title } : {}),
              ...(inferred.abstract ? { abstract: inferred.abstract } : {}),
              metadataSource: 'pdf-extraction',
            });
            extracted++;
            console.log(`[metadata-extraction] Refreshed metadata for: ${paper.title}`);
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        console.error('[metadata-extraction] Failed for:', paper.id, error);
        failed++;
      }

      metadataExtractionProgress.completed++;
      broadcastMetadataExtractionStatus();
    }
  }

  // Run with concurrency
  await Promise.all(
    Array.from({ length: Math.min(AUTO_ENRICH_CONCURRENCY, papersWithPdf.length) }, worker),
  );

  metadataExtractionActive = false;
  broadcastMetadataExtractionStatus();

  return { extracted, failed };
}

export function getMetadataExtractionStatus() {
  return {
    active: metadataExtractionActive,
    ...metadataExtractionProgress,
  };
}

/**
 * Extract metadata for a single paper.
 * - If a PDF is available, extract title/abstract from PDF text.
 * - Otherwise, search OpenAlex by title to fill in metadata.
 */
export async function extractPaperMetadata(
  paperId: string,
): Promise<{ success: boolean; title?: string; abstract?: string }> {
  const repo = new PapersRepository();
  const paper = await repo.findById(paperId);

  if (!paper) {
    throw new Error('Paper not found');
  }

  // Accumulate updates across strategies — each strategy fills in what it can
  const updates: Parameters<typeof repo.updateMetadata>[1] = {};
  const noAuthors =
    !paper.authors ||
    (Array.isArray(paper.authors) && paper.authors.length === 0) ||
    paper.authors === '[]';

  // Extract PDF text once and reuse across strategies
  let pdfExcerpt: string | null = null;
  if (paper.pdfPath || paper.pdfUrl) {
    pdfExcerpt = await getPaperExcerptCached(
      paper.id,
      paper.shortId,
      paper.pdfUrl ?? undefined,
      paper.pdfPath ?? undefined,
      6000,
    );
  }

  // Strategy 1: Extract title/abstract from PDF text via regex
  if (pdfExcerpt) {
    const inferred = inferTitleAndAbstractFromExcerpt(pdfExcerpt);
    if (inferred.title && !paper.title) updates.title = inferred.title;
    if (inferred.abstract && !paper.abstract) updates.abstract = inferred.abstract;
    if (inferred.title || inferred.abstract) {
      console.log(
        `[metadata-extraction] PDF extracted: title=${!!inferred.title}, abstract=${!!inferred.abstract}`,
      );
    }
  }

  // Strategy 2: Search OpenAlex by title
  if (paper.title) {
    try {
      const { searchPapers } = await import('./paper-search.service');
      const response = await searchPapers(paper.title, 3);
      // Find a result whose title closely matches the paper title
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const paperNorm = normalize(paper.title);
      const match = response.results.find((r) => {
        const rNorm = normalize(r.title);
        return rNorm === paperNorm || rNorm.includes(paperNorm) || paperNorm.includes(rNorm);
      });
      if (match) {
        if (match.abstract && !paper.abstract) updates.abstract = match.abstract;
        if (match.authors?.length && noAuthors) updates.authors = match.authors.map((a) => a.name);
        if (match.venue && !paper.venue) updates.venue = match.venue;
        if (match.year && !paper.submittedAt) updates.submittedAt = new Date(match.year, 0, 1);
        console.log(
          `[metadata-extraction] OpenAlex matched: "${match.title}" authors=${match.authors?.length ?? 0}`,
        );
      } else if (response.results.length > 0) {
        console.log(
          `[metadata-extraction] OpenAlex top result title mismatch: "${response.results[0].title}" vs "${paper.title}"`,
        );
      }
    } catch (oaErr) {
      console.error('[metadata-extraction] OpenAlex lookup failed:', oaErr);
    }
  }

  // Strategy 3: Use LLM to extract/enrich metadata.
  // If we have PDF text, ask LLM to extract from the text (much more reliable).
  // Otherwise, ask LLM to look up by title (may fail for obscure papers).
  if (paper.title) {
    const { generateWithModelKind, getSelectedModelInfo } = await import('./ai-provider.service');
    const lightweight = getSelectedModelInfo('lightweight');
    if (!lightweight) {
      console.warn('[metadata-extraction] No lightweight model configured — cannot use LLM');
    } else {
      // Use the already-extracted PDF text, trimmed to just the header (before Introduction)
      let pdfHeader: string | undefined;
      if (pdfExcerpt) {
        const introIdx = pdfExcerpt.search(
          /\n\s*(?:1[\s.]+)?introduction\b|\n\s*I\.\s+INTRODUCTION|\n\s*1\s+Introduction/i,
        );
        pdfHeader = introIdx > 50 ? pdfExcerpt.slice(0, introIdx) : pdfExcerpt.slice(0, 1500);
      }

      const systemPrompt = pdfHeader
        ? [
            'Extract metadata from the following academic paper text.',
            'Return strict JSON only with these keys: authors, abstract, venue, year.',
            'authors must be an array of full name strings (extract from the paper header).',
            'venue is the conference or journal name (string or null).',
            'year is an integer or null.',
            'abstract is the full abstract text (string or null).',
            'If a field cannot be determined from the text, use null.',
            'Return JSON only, no markdown fences.',
          ].join(' ')
        : [
            'You are an academic metadata lookup assistant.',
            'Given a paper title, return the paper metadata as strict JSON.',
            'Use exactly these keys: authors, abstract, venue, year.',
            'authors must be an array of full name strings.',
            'venue is the conference or journal name (string or null).',
            'year is an integer or null.',
            'abstract is the full abstract text (string or null).',
            'If you are not confident about any field, use null.',
            'Return JSON only, no markdown fences.',
          ].join(' ');

      const userPrompt = pdfHeader
        ? `Paper text:\n\n${pdfHeader}`
        : `Paper title: "${paper.title}"`;

      console.log(
        `[metadata-extraction] Calling LLM (${pdfHeader ? 'from PDF text' : 'by title'}) for: ${paper.title}`,
      );
      const response = await generateWithModelKind('lightweight', systemPrompt, userPrompt, {
        strictSelection: true,
      });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          authors?: string[] | null;
          abstract?: string | null;
          venue?: string | null;
          year?: number | null;
        };
        console.log(
          `[metadata-extraction] LLM returned: authors=${parsed.authors?.length ?? 'null'}, abstract=${!!parsed.abstract}`,
        );
        if (Array.isArray(parsed.authors) && parsed.authors.length > 0 && !updates.authors)
          updates.authors = parsed.authors;
        if (parsed.abstract && !updates.abstract && !paper.abstract)
          updates.abstract = parsed.abstract;
        if (parsed.venue && !updates.venue && !paper.venue) updates.venue = parsed.venue;
        if (parsed.year && !updates.submittedAt && !paper.submittedAt)
          updates.submittedAt = new Date(parsed.year, 0, 1);
      }
    }
  }

  // Check if we have any real field updates (not just metadataSource)
  const { metadataSource: _ms, ...fieldUpdates } = updates;
  const hasRealUpdates = Object.keys(fieldUpdates).length > 0;

  if (hasRealUpdates) {
    // Build metadataSource from which strategies contributed
    const sources: string[] = [];
    if (updates.title || updates.abstract) sources.push('pdf-extraction');
    if (updates.venue || updates.submittedAt) sources.push('openalex');
    if (updates.authors) sources.push('llm');
    updates.metadataSource = sources.join('+') || 'mixed';
    await repo.updateMetadata(paper.id, updates);
    console.log(
      `[metadata-extraction] Saved: ${JSON.stringify(Object.keys(fieldUpdates))} for: ${paper.title}`,
    );
    return { success: true, title: paper.title, abstract: updates.abstract ?? undefined };
  }

  throw new Error('Could not extract or find metadata for this paper');
}
