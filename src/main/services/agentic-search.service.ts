import { PapersRepository } from '@db';
import { generateWithModelKind } from './ai-provider.service';

export interface AgenticSearchStep {
  type: 'thinking' | 'searching' | 'found' | 'done';
  message: string;
  keywords?: string[];
  foundCount?: number;
}

export interface AgenticSearchResult {
  steps: AgenticSearchStep[];
  papers: Array<{
    id: string;
    shortId: string;
    title: string;
    authors?: string[];
    year?: number;
    tagNames?: string[];
    abstract?: string;
    relevanceReason?: string;
  }>;
}

const SYSTEM_PROMPT = `You are an intelligent research paper search assistant. Your job is to:
1. Analyze the user's search query to understand their intent
2. Extract relevant keywords for searching papers (topics, methods, author names, concepts)
3. Decide the best search strategy

You respond in JSON format with these fields:
- "thinking": brief explanation of what you understood from the query
- "keywords": array of 3-7 relevant search keywords extracted from the query
- "strategy": "title" | "tag" | "author" | "mixed" - which field to prioritize
- "reasoning": brief explanation of your keyword choices

Keep responses concise and focused on paper search.`;

export class AgenticSearchService {
  private papersRepository = new PapersRepository();

  async search(
    query: string,
    onStep?: (step: AgenticSearchStep) => void,
  ): Promise<AgenticSearchResult> {
    const steps: AgenticSearchStep[] = [];

    // Step 1: AI analyzes the query
    onStep?.({
      type: 'thinking',
      message: 'Analyzing your search query...',
    });
    steps.push({
      type: 'thinking',
      message: 'Analyzing your search query...',
    });

    let keywords: string[] = [];
    let strategy = 'mixed';

    try {
      const aiResponse = await generateWithModelKind('lightweight', SYSTEM_PROMPT, query);

      const parsed = this.parseAiResponse(aiResponse);
      keywords = parsed.keywords;
      strategy = parsed.strategy;

      steps.push({
        type: 'thinking',
        message: parsed.thinking,
        keywords,
      });
      onStep?.({
        type: 'thinking',
        message: parsed.thinking,
        keywords,
      });
    } catch (error) {
      // Fallback: use original query as keyword
      keywords = query.split(/\s+/).filter((w) => w.length > 2);
      steps.push({
        type: 'thinking',
        message: `Using keywords from query: ${keywords.join(', ')}`,
        keywords,
      });
      onStep?.({
        type: 'thinking',
        message: `Using keywords from query: ${keywords.join(', ')}`,
        keywords,
      });
    }

    // Step 2: Execute search with extracted keywords
    onStep?.({
      type: 'searching',
      message: `Searching by ${strategy}...`,
      keywords,
    });
    steps.push({
      type: 'searching',
      message: `Searching by ${strategy}...`,
      keywords,
    });

    const papers = await this.searchWithKeywords(keywords, strategy);

    steps.push({
      type: 'found',
      message: `Found ${papers.length} matching papers`,
      foundCount: papers.length,
    });
    onStep?.({
      type: 'found',
      message: `Found ${papers.length} matching papers`,
      foundCount: papers.length,
    });

    // Step 3: If few results, try broader search
    if (papers.length < 3 && keywords.length > 1) {
      onStep?.({
        type: 'searching',
        message: 'Broadening search with fewer keywords...',
      });
      steps.push({
        type: 'searching',
        message: 'Broadening search with fewer keywords...',
      });

      const broaderKeywords = keywords.slice(0, Math.ceil(keywords.length / 2));
      const morePapers = await this.searchWithKeywords(broaderKeywords, strategy);

      // Merge results, avoiding duplicates
      const existingIds = new Set(papers.map((p) => p.id));
      for (const paper of morePapers) {
        if (!existingIds.has(paper.id)) {
          papers.push(paper);
        }
      }

      steps.push({
        type: 'found',
        message: `Total: ${papers.length} papers after broader search`,
        foundCount: papers.length,
      });
      onStep?.({
        type: 'found',
        message: `Total: ${papers.length} papers after broader search`,
        foundCount: papers.length,
      });
    }

    // Step 4: Generate relevance reasons for top results
    if (papers.length > 0 && keywords.length > 0) {
      await this.addRelevanceReasons(papers.slice(0, 5), keywords, query);
    }

    steps.push({
      type: 'done',
      message: 'Search complete',
    });
    onStep?.({
      type: 'done',
      message: 'Search complete',
    });

    return { steps, papers };
  }

  private parseAiResponse(response: string): {
    thinking: string;
    keywords: string[];
    strategy: string;
    reasoning: string;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          thinking: parsed.thinking || 'Analyzing query...',
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          strategy: parsed.strategy || 'mixed',
          reasoning: parsed.reasoning || '',
        };
      }
    } catch {
      // Fallback
    }

    // Fallback: extract words that look like keywords
    const words = response
      .split(/[\s,.\-:;]+/)
      .filter((w) => w.length > 3 && !this.isCommonWord(w));
    return {
      thinking: 'Extracting keywords from query',
      keywords: words.slice(0, 5),
      strategy: 'mixed',
      reasoning: '',
    };
  }

  private isCommonWord(word: string): boolean {
    const common = new Set([
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'her',
      'was',
      'one',
      'our',
      'out',
      'with',
      'this',
      'that',
      'these',
      'those',
      'from',
      'they',
      'will',
      'would',
      'there',
      'their',
      'what',
      'about',
      'which',
      'when',
      'make',
      'like',
      'just',
      'over',
      'such',
      'into',
      'year',
      'some',
      'them',
      'than',
      'then',
      'look',
      'only',
      'come',
      'could',
      'after',
      'also',
      'should',
      'paper',
      'papers',
      'research',
      'study',
      'using',
    ]);
    return common.has(word.toLowerCase());
  }

  private async searchWithKeywords(
    keywords: string[],
    strategy: string,
  ): Promise<AgenticSearchResult['papers']> {
    const results: AgenticSearchResult['papers'] = [];
    const seenIds = new Set<string>();

    // Search with each keyword
    for (const keyword of keywords.slice(0, 5)) {
      try {
        let papers;

        switch (strategy) {
          case 'tag':
            papers = await this.papersRepository.list({ tag: keyword });
            break;
          case 'author':
            // Search in title (authors stored as JSON, harder to query)
            papers = await this.papersRepository.list({ q: keyword });
            break;
          default:
            papers = await this.papersRepository.list({ q: keyword });
        }

        for (const paper of papers) {
          if (!seenIds.has(paper.id)) {
            seenIds.add(paper.id);
            results.push({
              id: paper.id,
              shortId: paper.shortId,
              title: paper.title,
              authors: paper.authors,
              year: paper.year ?? undefined,
              tagNames: paper.tagNames,
              abstract: paper.abstract ?? undefined,
            });
          }
        }
      } catch {
        // Continue with next keyword if one fails
      }
    }

    // Sort by relevance (more keyword matches = higher score)
    const keywordLower = keywords.map((k) => k.toLowerCase());
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, keywordLower);
      const scoreB = this.calculateRelevanceScore(b, keywordLower);
      return scoreB - scoreA;
    });

    return results.slice(0, 20);
  }

  private calculateRelevanceScore(
    paper: AgenticSearchResult['papers'][0],
    keywordsLower: string[],
  ): number {
    let score = 0;

    const titleLower = paper.title.toLowerCase();
    const tagsLower = (paper.tagNames || []).map((t) => t.toLowerCase());
    const abstractLower = (paper.abstract || '').toLowerCase();

    for (const keyword of keywordsLower) {
      // Title matches are most important
      if (titleLower.includes(keyword)) {
        score += 10;
      }
      // Tag matches
      if (tagsLower.some((t) => t.includes(keyword))) {
        score += 5;
      }
      // Abstract matches
      if (abstractLower.includes(keyword)) {
        score += 2;
      }
    }

    // Boost papers with ratings
    return score;
  }

  private async addRelevanceReasons(
    papers: AgenticSearchResult['papers'],
    keywords: string[],
    originalQuery: string,
  ): Promise<void> {
    const keywordLower = keywords.map((k) => k.toLowerCase());

    for (const paper of papers) {
      const reasons: string[] = [];

      for (const keyword of keywordLower) {
        if (paper.title.toLowerCase().includes(keyword)) {
          reasons.push(`title matches "${keyword}"`);
        }
        if (paper.tagNames?.some((t) => t.toLowerCase().includes(keyword))) {
          const matchingTag = paper.tagNames.find((t) => t.toLowerCase().includes(keyword));
          if (matchingTag) {
            reasons.push(`tagged with "${matchingTag}"`);
          }
        }
      }

      paper.relevanceReason =
        reasons.length > 0 ? `Matched: ${reasons.slice(0, 3).join(', ')}` : 'Semantic match';
    }
  }
}
