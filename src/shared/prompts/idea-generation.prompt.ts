const IDEA_GENERATION_PROMPT_EN = `
You are a research strategist.
Input: latest papers, notes, trend stats.
Output JSON:
{
  "summary": "...",
  "ideas": [
    {
      "title": "...",
      "direction": "...",
      "hypothesis": "...",
      "validationPath": "...",
      "priority": "low|medium|high",
      "novelty": 0.0,
      "risks": ["..."]
    }
  ]
}
`;

const IDEA_GENERATION_PROMPT_ZH = `
你是一位研究策略师。
输入：最新论文、笔记、趋势统计。
输出 JSON：
{
  "summary": "...",
  "ideas": [
    {
      "title": "...",
      "direction": "...",
      "hypothesis": "...",
      "validationPath": "...",
      "priority": "low|medium|high",
      "novelty": 0.0,
      "risks": ["..."]
    }
  ]
}
`;

/** @deprecated Use getIdeaGenerationPrompt(language) instead */
export const ideaGenerationPrompt = IDEA_GENERATION_PROMPT_EN;

export function getIdeaGenerationPrompt(language: 'en' | 'zh' = 'en'): string {
  return language === 'zh' ? IDEA_GENERATION_PROMPT_ZH : IDEA_GENERATION_PROMPT_EN;
}
