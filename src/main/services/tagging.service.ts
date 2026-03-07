import { BrowserWindow } from 'electron';
import { PapersRepository } from '@db';
import {
  TAGGING_SYSTEM_PROMPT,
  buildTaggingUserPrompt,
  parseTaggingResponse,
  GENERIC_TAGS,
  TAG_CONSOLIDATION_SYSTEM_PROMPT,
  TAG_ORGANIZE_SYSTEM_PROMPT,
  buildOrganizeUserPrompt,
  type CategorizedTagResult,
} from '@shared';
import type { TagCategory, CategorizedTag } from '@shared';
import {
  generateWithModelKind,
  getSelectedModelInfo,
  streamGenerateWithModelKind,
} from './ai-provider.service';
import { appendLog } from './app-log.service';
import {
  getAppSettings,
  setTagMigrationDone,
  isTagMigrationDone,
} from '../store/app-settings-store';
import { getPaperExcerptCached } from './paper-text.service';

// ── Status management (singleton) ─────────────────────────────────────────

export interface TaggingStatus {
  active: boolean;
  total: number;
  completed: number;
  failed: number;
  currentPaperId: string | null;
  currentPaperTitle?: string | null;
  stage:
    | 'idle'
    | 'building_prompt'
    | 'requesting_model'
    | 'streaming'
    | 'parsing'
    | 'saving'
    | 'fallback'
    | 'done'
    | 'error';
  partialText?: string;
  message: string;
}

let currentStatus: TaggingStatus = {
  active: false,
  total: 0,
  completed: 0,
  failed: 0,
  currentPaperId: null,
  currentPaperTitle: null,
  stage: 'idle',
  partialText: '',
  message: '',
};
let cancelRequested = false;

function broadcastTaggingStatus() {
  const wins = BrowserWindow ? BrowserWindow.getAllWindows() : [];
  for (const win of wins) {
    win.webContents.send('tagging:status', currentStatus);
  }
}

export function getTaggingStatus(): TaggingStatus {
  return { ...currentStatus };
}

export function cancelTagging() {
  if (currentStatus.active) cancelRequested = true;
}

function updateSinglePaperStatus(
  patch: Partial<TaggingStatus>,
  options: { broadcast?: boolean } = {},
) {
  currentStatus = {
    ...currentStatus,
    active: true,
    total: currentStatus.total || 1,
    ...patch,
  };
  if (options.broadcast !== false) {
    broadcastTaggingStatus();
  }
}

// ── Keyword fallback (categorized) ────────────────────────────────────────

const CATEGORIZED_KEYWORDS: Array<{ keywords: string[]; tags: CategorizedTag[] }> = [
  {
    keywords: ['language model', 'llm', 'gpt', 'claude', 'llama', 'chatbot'],
    tags: [
      { name: 'nlp', category: 'domain' as TagCategory },
      { name: 'language-model', category: 'method' as TagCategory },
    ],
  },
  {
    keywords: ['transformer', 'attention mechanism', 'self-attention'],
    tags: [{ name: 'transformer', category: 'method' as TagCategory }],
  },
  {
    keywords: ['diffusion', 'stable diffusion', 'ddpm', 'score-based'],
    tags: [{ name: 'diffusion', category: 'method' as TagCategory }],
  },
  {
    keywords: ['vision', 'image classification', 'visual', 'image recognition'],
    tags: [{ name: 'cv', category: 'domain' as TagCategory }],
  },
  {
    keywords: ['multimodal', 'vision-language', 'vlm'],
    tags: [{ name: 'multimodal', category: 'domain' as TagCategory }],
  },
  {
    keywords: ['reinforcement learning', ' rl ', 'reward model', 'policy gradient'],
    tags: [{ name: 'rl', category: 'domain' as TagCategory }],
  },
  {
    keywords: ['robot', 'embodied', 'manipulation', 'locomotion'],
    tags: [{ name: 'robotics', category: 'domain' as TagCategory }],
  },
  {
    keywords: ['retrieval', 'rag', 'retrieval-augmented'],
    tags: [{ name: 'rag', category: 'method' as TagCategory }],
  },
  {
    keywords: ['rlhf', 'dpo', 'alignment', 'harmless', 'safety'],
    tags: [{ name: 'safety-alignment', category: 'topic' as TagCategory }],
  },
  {
    keywords: ['code generation', 'programming', 'code completion'],
    tags: [{ name: 'code-generation', category: 'topic' as TagCategory }],
  },
  {
    keywords: ['benchmark', 'evaluation', 'leaderboard'],
    tags: [{ name: 'benchmark', category: 'topic' as TagCategory }],
  },
  {
    keywords: ['agent', 'tool use', 'planning', 'agentic'],
    tags: [{ name: 'agent', category: 'topic' as TagCategory }],
  },
  {
    keywords: ['speech', 'audio', 'tts', 'asr'],
    tags: [{ name: 'audio', category: 'domain' as TagCategory }],
  },
  {
    keywords: ['graph neural', 'gnn', 'knowledge graph'],
    tags: [{ name: 'graph-neural-network', category: 'method' as TagCategory }],
  },
  {
    keywords: ['repair', 'program repair', 'bug fix', 'bug-fixing', 'debugging'],
    tags: [
      { name: 'systems', category: 'domain' as TagCategory },
      { name: 'program-repair', category: 'method' as TagCategory },
      { name: 'bug-fixing', category: 'topic' as TagCategory },
    ],
  },
  {
    keywords: ['software engineering', 'software', 'testing'],
    tags: [
      { name: 'systems', category: 'domain' as TagCategory },
      { name: 'software-engineering', category: 'topic' as TagCategory },
    ],
  },
  {
    keywords: ['gan', 'generative adversarial'],
    tags: [{ name: 'gan', category: 'method' as TagCategory }],
  },
  {
    keywords: ['distillation', 'knowledge distillation'],
    tags: [{ name: 'distillation', category: 'method' as TagCategory }],
  },
  {
    keywords: ['mixture of experts', 'moe'],
    tags: [{ name: 'moe', category: 'method' as TagCategory }],
  },
];

function normalizeTextLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function inferTitleAndAbstractFromExcerpt(excerpt: string): { title?: string; abstract?: string } {
  if (!excerpt.trim()) return {};

  const lines = excerpt.split(/\r?\n/).map(normalizeTextLine).filter(Boolean).slice(0, 120);

  if (lines.length === 0) return {};

  const abstractIndex = lines.findIndex((line) => /^abstract\b[:\s-]*$/i.test(line));

  let title: string | undefined;
  const titleCandidates = lines
    .slice(0, abstractIndex > 0 ? abstractIndex : 8)
    .filter(
      (line) =>
        !/^(abstract|introduction|keywords?|authors?|proceedings?|arxiv|doi)\b/i.test(line) &&
        line.length >= 8,
    )
    .slice(0, 2);

  if (titleCandidates.length > 0) {
    title = titleCandidates.join(' ').slice(0, 200).trim();
  }

  let abstract: string | undefined;
  if (abstractIndex >= 0) {
    const abstractLines: string[] = [];
    for (const line of lines.slice(abstractIndex + 1)) {
      if (
        /^(introduction|1\.?\s+introduction|keywords?|index terms|background|related work)\b/i.test(
          line,
        )
      ) {
        break;
      }
      abstractLines.push(line);
      if (abstractLines.join(' ').length >= 1200) break;
    }
    const joined = abstractLines.join(' ').trim();
    if (joined.length >= 40) {
      abstract = joined;
    }
  }

  return { title, abstract };
}

function mergeWithFallbackTags(
  clean: CategorizedTagResult,
  fallbackTags: CategorizedTag[],
): CategorizedTagResult {
  const fallbackByCategory: Record<TagCategory, string[]> = {
    domain: fallbackTags.filter((tag) => tag.category === 'domain').map((tag) => tag.name),
    method: fallbackTags.filter((tag) => tag.category === 'method').map((tag) => tag.name),
    topic: fallbackTags.filter((tag) => tag.category === 'topic').map((tag) => tag.name),
  };

  return {
    domain: (clean.domain.length > 0 ? clean.domain : fallbackByCategory.domain).slice(0, 2),
    method: (clean.method.length > 0 ? clean.method : fallbackByCategory.method).slice(0, 3),
    topic: (clean.topic.length > 0 ? clean.topic : fallbackByCategory.topic).slice(0, 3),
  };
}

function keywordFallbackTag(title: string, abstract: string): CategorizedTag[] {
  const text = `${title} ${abstract}`.toLowerCase();
  const matched = new Map<string, CategorizedTag>(); // dedup by name

  for (const entry of CATEGORIZED_KEYWORDS) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      for (const tag of entry.tags) {
        matched.set(tag.name, tag);
      }
    }
  }

  if (matched.size === 0) {
    return [{ name: 'uncategorized', category: 'topic' as TagCategory }];
  }
  return Array.from(matched.values());
}

// ── Vocabulary cache ──────────────────────────────────────────────────────

let vocabCache: { domain: string[]; method: string[]; topic: string[] } | null = null;
let vocabCacheTime = 0;
const VOCAB_CACHE_TTL = 30_000; // 30 seconds

async function getVocabulary(repo: PapersRepository) {
  if (vocabCache && Date.now() - vocabCacheTime < VOCAB_CACHE_TTL) {
    return vocabCache;
  }
  vocabCache = await repo.listTagVocabulary();
  vocabCacheTime = Date.now();
  return vocabCache;
}

// ── Core: tag a single paper ──────────────────────────────────────────────

export async function tagPaper(
  paperId: string,
  options: { managedStatus?: boolean } = {},
): Promise<CategorizedTag[]> {
  const managedStatus = options.managedStatus ?? true;
  const repo = new PapersRepository();
  const paper = await repo.findById(paperId);
  if (!paper) throw new Error('Paper not found');

  if (managedStatus) {
    currentStatus = {
      active: true,
      total: 1,
      completed: 0,
      failed: 0,
      currentPaperId: paperId,
      currentPaperTitle: paper.title,
      stage: 'building_prompt',
      partialText: '',
      message: 'Preparing auto-tagging prompt…',
    };
    broadcastTaggingStatus();
  } else {
    updateSinglePaperStatus({
      currentPaperId: paperId,
      currentPaperTitle: paper.title,
      stage: 'building_prompt',
      partialText: '',
      message: `Preparing tags for ${paper.title}…`,
    });
  }

  const vocabulary = await getVocabulary(repo);

  const metadataTitle = paper.title.replace(/^\[\d{4}\.\d{4,5}\]\s*/, ''); // strip arxiv prefix
  const metadataAbstract = paper.abstract ?? '';
  let pdfExcerpt = '';

  if (paper.shortId && (paper.pdfUrl || paper.pdfPath)) {
    try {
      pdfExcerpt = await getPaperExcerptCached(
        paper.id,
        paper.shortId,
        paper.pdfUrl ?? undefined,
        paper.pdfPath ?? undefined,
        6000,
      );
    } catch {
      pdfExcerpt = '';
    }
  }

  const inferred = inferTitleAndAbstractFromExcerpt(pdfExcerpt);
  const title =
    inferred.title && inferred.title.length > metadataTitle.length + 10
      ? inferred.title
      : metadataTitle;
  const abstract = metadataAbstract.trim() || inferred.abstract || '';

  appendLog(
    'tagging',
    'tagPaper:start',
    {
      paperId,
      metadataTitle,
      inferredTitle: inferred.title,
      title,
      abstractPreview: abstract.slice(0, 300),
      metadataAbstractPreview: metadataAbstract.slice(0, 300),
      inferredAbstractPreview: inferred.abstract?.slice(0, 300),
      excerptPreview: pdfExcerpt.slice(0, 500),
      managedStatus,
      vocabulary,
      selectedModel: getSelectedModelInfo('lightweight'),
    },
    'tagging.log',
  );

  // Attempt 1: AI tagging
  try {
    const userPrompt = buildTaggingUserPrompt(title, abstract, vocabulary, pdfExcerpt);
    updateSinglePaperStatus({
      currentPaperId: paperId,
      currentPaperTitle: paper.title,
      stage: 'requesting_model',
      message: 'Requesting lightweight model…',
    });

    let streamedText = '';
    const response = await streamGenerateWithModelKind(
      'lightweight',
      TAGGING_SYSTEM_PROMPT,
      userPrompt,
      (chunk) => {
        streamedText += chunk;
        updateSinglePaperStatus({
          currentPaperId: paperId,
          currentPaperTitle: paper.title,
          stage: 'streaming',
          partialText: streamedText,
          message: streamedText.trim()
            ? `Generating tags… ${Math.min(streamedText.trim().length, 240)} chars`
            : 'Generating tags…',
        });
      },
      undefined,
      { strictSelection: true },
    );

    appendLog('tagging', 'tagPaper:model_response', { paperId, response }, 'tagging.log');

    updateSinglePaperStatus({
      currentPaperId: paperId,
      currentPaperTitle: paper.title,
      stage: 'parsing',
      partialText: response,
      message: 'Parsing model response…',
    });
    const parsed = parseTaggingResponse(response);
    appendLog('tagging', 'tagPaper:parsed_response', { paperId, parsed }, 'tagging.log');

    if (parsed) {
      const fallbackTags = keywordFallbackTag(title, abstract || pdfExcerpt);
      // Filter out generic tags
      const cleanBase: CategorizedTagResult = {
        domain: parsed.domain.filter((t) => !GENERIC_TAGS.has(t)).slice(0, 2),
        method: parsed.method.filter((t) => !GENERIC_TAGS.has(t)).slice(0, 3),
        topic: parsed.topic.filter((t) => !GENERIC_TAGS.has(t)).slice(0, 3),
      };
      const clean = mergeWithFallbackTags(cleanBase, fallbackTags);

      const total = clean.domain.length + clean.method.length + clean.topic.length;
      appendLog(
        'tagging',
        'tagPaper:filtered_tags',
        { paperId, cleanBase, clean, fallbackTags, total },
        'tagging.log',
      );
      if (total > 0) {
        const allTags: CategorizedTag[] = [
          ...clean.domain.map((name) => ({ name, category: 'domain' as TagCategory })),
          ...clean.method.map((name) => ({ name, category: 'method' as TagCategory })),
          ...clean.topic.map((name) => ({ name, category: 'topic' as TagCategory })),
        ];
        updateSinglePaperStatus({
          currentPaperId: paperId,
          currentPaperTitle: paper.title,
          stage: 'saving',
          message: `Saving ${total} tags…`,
        });
        await repo.updateTagsWithCategories(paperId, allTags);
        appendLog('tagging', 'tagPaper:saved_ai_tags', { paperId, allTags }, 'tagging.log');
        vocabCache = null; // invalidate
        if (managedStatus) {
          currentStatus = {
            ...currentStatus,
            active: false,
            completed: 1,
            currentPaperId: null,
            currentPaperTitle: null,
            stage: 'done',
            message: `Done: ${total} tags added`,
          };
          broadcastTaggingStatus();
        }
        return allTags;
      }
    }
  } catch (err) {
    appendLog(
      'tagging',
      'tagPaper:model_error',
      { paperId, error: err instanceof Error ? err.message : String(err) },
      'tagging.log',
    );
    updateSinglePaperStatus({
      currentPaperId: paperId,
      currentPaperTitle: paper.title,
      stage: 'fallback',
      message:
        err instanceof Error ? `Model tagging failed, using fallback…` : 'Using fallback tags…',
    });
    // AI failed, fall through to keyword
  }

  // Attempt 2: Keyword fallback
  updateSinglePaperStatus({
    currentPaperId: paperId,
    currentPaperTitle: paper.title,
    stage: 'fallback',
    partialText: '',
    message: 'Applying keyword fallback…',
  });
  const fallbackTags = keywordFallbackTag(title, abstract);
  appendLog('tagging', 'tagPaper:fallback_tags', { paperId, fallbackTags }, 'tagging.log');
  await repo.updateTagsWithCategories(paperId, fallbackTags);
  appendLog('tagging', 'tagPaper:saved_fallback_tags', { paperId, fallbackTags }, 'tagging.log');
  vocabCache = null;
  if (managedStatus) {
    currentStatus = {
      ...currentStatus,
      active: false,
      completed: 1,
      currentPaperId: null,
      currentPaperTitle: null,
      stage: 'done',
      message: `Done: ${fallbackTags.length} fallback tags added`,
    };
    broadcastTaggingStatus();
  }
  return fallbackTags;
}

// ── Batch: tag all untagged papers ────────────────────────────────────────

const BATCH_CONCURRENCY = 3;

export async function tagUntaggedPapers(): Promise<{ tagged: number; failed: number }> {
  const repo = new PapersRepository();
  const untaggedIds = await repo.listUntaggedPaperIds();

  if (untaggedIds.length === 0) {
    return { tagged: 0, failed: 0 };
  }

  cancelRequested = false;
  currentStatus = {
    active: true,
    total: untaggedIds.length,
    completed: 0,
    failed: 0,
    currentPaperId: null,
    currentPaperTitle: null,
    stage: 'building_prompt',
    partialText: '',
    message: `Tagging ${untaggedIds.length} papers...`,
  };
  broadcastTaggingStatus();

  let tagged = 0;
  let failed = 0;
  let idx = 0;

  async function worker() {
    while (idx < untaggedIds.length && !cancelRequested) {
      const paperId = untaggedIds[idx++];
      currentStatus.currentPaperId = paperId;
      currentStatus.currentPaperTitle = null;
      try {
        await tagPaper(paperId, { managedStatus: false });
        tagged++;
      } catch (err) {
        console.error('[tagging] Failed:', paperId, err);
        failed++;
      }
      currentStatus.completed++;
      currentStatus.failed = failed;
      currentStatus.message = `Tagging... ${currentStatus.completed}/${untaggedIds.length}`;
      broadcastTaggingStatus();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, untaggedIds.length) }, worker),
  );

  currentStatus = {
    active: false,
    total: untaggedIds.length,
    completed: untaggedIds.length,
    failed,
    currentPaperId: null,
    currentPaperTitle: null,
    stage: cancelRequested ? 'done' : 'done',
    partialText: '',
    message: cancelRequested
      ? `Cancelled: ${tagged} tagged, ${failed} failed`
      : `Done: ${tagged} tagged, ${failed} failed`,
  };
  broadcastTaggingStatus();

  return { tagged, failed };
}

// ── "Organize" — re-categorize existing flat tags via AI ──────────────────

export async function organizePaperTags(paperId: string): Promise<CategorizedTag[]> {
  const repo = new PapersRepository();
  const paper = await repo.findById(paperId);
  if (!paper) throw new Error('Paper not found');

  const existingTags = paper.tagNames || [];
  if (existingTags.length === 0) throw new Error('No tags to organize');

  // Filter out system tags
  const EXCLUDED = new Set(['arxiv', 'chrome', 'manual', 'pdf']);
  const tagsToOrganize = existingTags.filter((t) => !EXCLUDED.has(t));
  if (tagsToOrganize.length === 0) return [];

  const title = paper.title.replace(/^\[\d{4}\.\d{4,5}\]\s*/, '');
  const abstract = paper.abstract ?? '';

  try {
    const userPrompt = buildOrganizeUserPrompt(title, abstract, tagsToOrganize);
    const response = await generateWithModelKind(
      'lightweight',
      TAG_ORGANIZE_SYSTEM_PROMPT,
      userPrompt,
    );
    const parsed = parseTaggingResponse(response);

    if (parsed) {
      const allTags: CategorizedTag[] = [
        ...parsed.domain.map((n) => ({ name: n, category: 'domain' as TagCategory })),
        ...parsed.method.map((n) => ({ name: n, category: 'method' as TagCategory })),
        ...parsed.topic.map((n) => ({ name: n, category: 'topic' as TagCategory })),
      ];

      // Also re-add any system tags that were excluded
      const systemTags = existingTags
        .filter((t) => EXCLUDED.has(t))
        .map((name) => ({ name, category: 'topic' as TagCategory }));

      await repo.updateTagsWithCategories(paperId, [...allTags, ...systemTags]);
      return allTags;
    }
  } catch {
    // AI failed — apply best-effort keyword categorization
  }

  // Fallback: categorize using known dictionaries
  const result: CategorizedTag[] = tagsToOrganize.map((name) => {
    if (KNOWN_DOMAINS.has(name)) return { name, category: 'domain' as TagCategory };
    if (KNOWN_METHODS.has(name)) return { name, category: 'method' as TagCategory };
    return { name, category: 'topic' as TagCategory };
  });
  await repo.updateTagsWithCategories(paperId, result);
  return result;
}

// ── AI consolidation suggestions ──────────────────────────────────────────

export interface ConsolidationSuggestion {
  merges: Array<{ keep: string; remove: string[]; reason: string }>;
  recategorize: Array<{ tag: string; from: string; to: string; reason: string }>;
}

export async function suggestConsolidation(): Promise<ConsolidationSuggestion> {
  const repo = new PapersRepository();
  const allTags = await repo.listAllTagsWithCategory();

  if (allTags.length === 0) {
    return { merges: [], recategorize: [] };
  }

  const tagList = allTags.map((t) => `${t.name} (${t.category}, ${t.count} papers)`).join('\n');

  const response = await generateWithModelKind(
    'lightweight',
    TAG_CONSOLIDATION_SYSTEM_PROMPT,
    `Current tags:\n${tagList}`,
  );

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { merges: [], recategorize: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ConsolidationSuggestion;
    return {
      merges: Array.isArray(parsed.merges) ? parsed.merges : [],
      recategorize: Array.isArray(parsed.recategorize) ? parsed.recategorize : [],
    };
  } catch {
    return { merges: [], recategorize: [] };
  }
}

// ── Known tag dictionaries for fallback ───────────────────────────────────

const KNOWN_DOMAINS = new Set([
  'nlp',
  'cv',
  'rl',
  'robotics',
  'systems',
  'security',
  'multimodal',
  'audio',
  'math',
  'biology',
  'neuroscience',
  'economics',
  'physics',
  'chemistry',
  'medicine',
  'vision',
]);

const KNOWN_METHODS = new Set([
  'transformer',
  'diffusion',
  'rlhf',
  'contrastive-learning',
  'cnn',
  'rnn',
  'attention',
  'graph-neural-network',
  'mcts',
  'bayesian',
  'gan',
  'vae',
  'rag',
  'moe',
  'distillation',
  'ppo',
  'dpo',
  'sft',
  'lora',
  'adapter',
  'self-supervised',
  'meta-learning',
  'few-shot',
  'in-context-learning',
  'flow-matching',
  'llm',
]);

// ── One-time migration for existing tags ──────────────────────────────────

export async function migrateExistingTagCategories(): Promise<void> {
  if (isTagMigrationDone()) return;

  const repo = new PapersRepository();
  const allTags = await repo.listAllTagsWithCategory();

  for (const tag of allTags) {
    if (tag.category !== 'topic') continue; // already categorized
    let newCategory: TagCategory = 'topic';
    if (KNOWN_DOMAINS.has(tag.name)) newCategory = 'domain';
    else if (KNOWN_METHODS.has(tag.name)) newCategory = 'method';

    if (newCategory !== 'topic') {
      await repo.recategorizeTag(tag.name, newCategory);
    }
  }

  setTagMigrationDone();
}
