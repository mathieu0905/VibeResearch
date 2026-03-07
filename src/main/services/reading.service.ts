import { ReadingRepository, PaperCodeLinksRepository, PapersRepository } from '@db';
import { generateWithModelKind } from './ai-provider.service';
import { getPaperExcerptCached } from './paper-text.service';

export interface CreateReadingInput {
  paperId?: string;
  type: 'paper' | 'code';
  title: string;
  content: Record<string, unknown>;
  repoUrl?: string;
  commitHash?: string;
}

export class ReadingService {
  private readingRepository = new ReadingRepository();
  private codeLinksRepository = new PaperCodeLinksRepository();
  private papersRepository = new PapersRepository();

  async create(input: CreateReadingInput) {
    const created = await this.readingRepository.create({
      ...input,
      version: 1,
    });

    if (input.type === 'code' && input.paperId && input.repoUrl) {
      await this.codeLinksRepository.create({
        paperId: input.paperId,
        repoUrl: input.repoUrl,
        commitHash: input.commitHash,
        confidence: 0.7,
        source: 'reading-note',
      });
    }

    return {
      ...created,
      content: JSON.parse(created.contentJson) as Record<string, unknown>,
    };
  }

  async update(id: string, content: Record<string, unknown>) {
    const updated = await this.readingRepository.update(id, content);
    return {
      ...updated,
      content: JSON.parse(updated.contentJson) as Record<string, unknown>,
    };
  }

  async getById(id: string) {
    return this.readingRepository.getById(id);
  }

  async listByPaper(paperId: string) {
    return this.readingRepository.listByPaper(paperId);
  }

  async saveChat(input: { paperId: string; noteId: string | null; messages: unknown[] }) {
    const contentJson = JSON.stringify(input.messages);
    if (input.noteId) {
      return this.readingRepository.updateRaw(input.noteId, contentJson);
    }
    const paper = await this.papersRepository.findById(input.paperId).catch(() => null);
    const title = paper ? `Chat: ${paper.title}` : 'Chat';
    const created = await this.readingRepository.create({
      paperId: input.paperId,
      type: 'paper',
      title,
      content: input.messages as unknown as Record<string, unknown>,
      version: 1,
    });
    return { ...created, id: created.id };
  }

  async aiEditNotes(input: {
    paperId: string;
    instruction: string;
    currentNotes: Record<string, string>;
    pdfUrl?: string;
  }): Promise<Record<string, string>> {
    // Fetch paper metadata to enrich the prompt
    const paper = await this.papersRepository.findById(input.paperId).catch(() => null);

    const systemPrompt = [
      'You are a research assistant helping to fill in reading notes for academic papers.',
      'Given the paper metadata and current notes structure, generate comprehensive reading notes.',
      'Return ONLY a valid JSON object with the same keys as the current notes, with filled-in values.',
      'Each value should be a concise but informative paragraph in the same language as the section prompt.',
      'Do not include markdown code fences or any text outside the JSON object.',
    ].join(' ');

    const paperContext: string[] = [];
    if (paper) {
      paperContext.push(`Title: ${paper.title}`);
      if (paper.authors && (paper.authors as string[]).length > 0) {
        paperContext.push(`Authors: ${(paper.authors as string[]).join(', ')}`);
      }
      if (paper.year) paperContext.push(`Year: ${paper.year}`);
      if (paper.abstract) paperContext.push(`Abstract:\n${paper.abstract}`);
    }

    // Try to get PDF excerpt with caching
    let pdfContext = '';
    if (input.paperId && paper?.shortId && (input.pdfUrl || paper?.pdfPath)) {
      try {
        pdfContext = await getPaperExcerptCached(
          input.paperId,
          paper.shortId,
          input.pdfUrl,
          paper?.pdfPath ?? undefined,
          8000,
        );
      } catch {
        // PDF extraction failed, continue without it
      }
    }

    const userPrompt = [
      ...(paperContext.length > 0 ? ['Paper Information:', ...paperContext, ''] : []),
      ...(pdfContext ? ['Paper excerpt:', pdfContext, ''] : []),
      `Instruction: ${input.instruction}`,
      '',
      'Current notes structure (fill in each section):',
      JSON.stringify(input.currentNotes, null, 2),
    ].join('\n');

    const text = await generateWithModelKind('chat', systemPrompt, userPrompt);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, string>;
      }
    } catch {
      // fallback to returning original
    }

    return input.currentNotes;
  }
}
