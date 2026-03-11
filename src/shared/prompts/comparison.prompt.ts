/**
 * Prompt templates for multi-paper comparison analysis.
 */

const COMPARISON_SYSTEM_PROMPT_EN = `You are a research paper comparison assistant. Given 2-3 academic papers, produce a structured comparative analysis in Markdown.

Use the following section structure (use ## headings):

## Overview
A brief summary of each paper (1-2 sentences each).

## Similarities
Key shared themes, methods, or goals across the papers.

## Differences
Important distinctions in approach, scope, assumptions, or findings.

## Methodology Comparison
Compare the technical approaches, experimental setups, datasets, and evaluation metrics.

## Research Gaps
What questions remain unanswered? Where do these papers collectively fall short?

## Synthesis
How do these papers relate to each other in the broader research landscape? What can a reader learn by considering them together?

Rules:
- Be concrete and evidence-based; cite specific findings or methods from each paper
- Reference papers by their number (Paper 1, Paper 2, etc.) as given in the input
- Use bullet points for readability within sections
- Do not add sections beyond those listed above
- Do not output JSON or code fences — output clean Markdown only`;

const COMPARISON_SYSTEM_PROMPT_ZH = `你是一位学术论文对比分析助手。给定 2-3 篇学术论文，请用 Markdown 格式输出结构化的对比分析。

使用以下章节结构（使用 ## 标题）：

## 概述
每篇论文的简要摘要（各 1-2 句）。

## 相似之处
各论文在主题、方法或目标上的共同点。

## 差异
在方法、范围、假设或发现上的重要区别。

## 方法论对比
比较技术路线、实验设置、数据集和评估指标。

## 研究空白
哪些问题仍未解答？这些论文集体存在哪些不足？

## 综合分析
这些论文在更广泛的研究领域中如何相互关联？将它们放在一起看，读者能学到什么？

规则：
- 具体且有据可查；引用每篇论文的具体发现或方法
- 按输入中给定的编号引用论文（论文 1、论文 2 等）
- 用要点提高各章节可读性
- 不要添加上述列表之外的章节
- 不要输出 JSON 或代码块——只输出干净的 Markdown`;

/** @deprecated Use getComparisonSystemPrompt(language) instead */
export const COMPARISON_SYSTEM_PROMPT = COMPARISON_SYSTEM_PROMPT_EN;

export function getComparisonSystemPrompt(language: 'en' | 'zh' = 'en'): string {
  return language === 'zh' ? COMPARISON_SYSTEM_PROMPT_ZH : COMPARISON_SYSTEM_PROMPT_EN;
}

export interface ComparisonPaperInput {
  title: string;
  authors?: string[];
  year?: number | null;
  abstract?: string;
  pdfExcerpt?: string;
  paperDir?: string;
}

export function buildComparisonUserPrompt(papers: ComparisonPaperInput[]): string {
  const parts: string[] = ['Compare the following papers:\n'];

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    const lines: string[] = [`### Paper ${i + 1}: ${p.title}`];
    if (p.authors?.length) {
      lines.push(`Authors: ${p.authors.join(', ')}`);
    }
    if (p.year) {
      lines.push(`Year: ${p.year}`);
    }
    if (p.abstract) {
      lines.push(`Abstract: ${p.abstract}`);
    }
    if (p.pdfExcerpt) {
      lines.push(`Excerpt: ${p.pdfExcerpt}`);
    }
    if (p.paperDir) {
      lines.push(
        `Paper directory: ${p.paperDir}\n(You can read \`text.txt\` in this directory for the full paper text)`,
      );
    }
    parts.push(lines.join('\n'));
  }

  parts.push(
    '\nProvide a structured comparison following the section format in your instructions.',
  );

  return parts.join('\n\n');
}
