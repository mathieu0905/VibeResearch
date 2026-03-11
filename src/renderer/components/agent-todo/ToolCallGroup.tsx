import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ToolCallCard } from './ToolCallCard';

interface Message {
  id: string;
  msgId: string;
  content: unknown;
  status?: string | null;
}

interface ToolCallGroupProps {
  tools: Message[];
}

function buildSummary(tools: Message[]): string {
  const counts: Record<string, number> = {};
  for (const t of tools) {
    const kind = (t.content as any)?.kind ?? 'other';
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts['read']) parts.push(`读取 ${counts['read']} 个文件`);
  if (counts['edit']) parts.push(`编辑 ${counts['edit']} 个文件`);
  if (counts['execute']) parts.push(`执行 ${counts['execute']} 条命令`);
  const searchN = (counts['glob'] ?? 0) + (counts['grep'] ?? 0);
  if (searchN) parts.push(`搜索 ${searchN} 次`);
  if (counts['mcp']) parts.push(`调用 ${counts['mcp']} 个工具`);
  return parts.join(' · ') || `${tools.length} 项操作`;
}

export function ToolCallGroup({ tools }: ToolCallGroupProps) {
  const hasPending = tools.some(
    (t) => !t.status || t.status === 'pending' || t.status === 'running',
  );
  const [expanded, setExpanded] = useState(hasPending);

  const summary = buildSummary(tools);

  if (!expanded) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-md cursor-pointer
          text-xs text-notion-text-secondary bg-notion-sidebar
          hover:bg-notion-accent-light hover:text-notion-accent transition-colors"
        onClick={() => setExpanded(true)}
      >
        <ChevronRight size={11} className="flex-shrink-0" />
        <span>{summary}</span>
        <span className="text-notion-text-tertiary ml-1">({tools.length})</span>
      </div>
    );
  }

  return (
    <div className="border border-notion-border rounded-lg overflow-hidden my-1">
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs
          text-notion-text-secondary bg-notion-sidebar
          hover:bg-notion-accent-light hover:text-notion-accent transition-colors"
        onClick={() => setExpanded(false)}
      >
        <ChevronDown size={11} className="flex-shrink-0" />
        <span>{summary}</span>
        <span className="ml-auto text-notion-text-tertiary">{tools.length} 步</span>
      </div>
      <div className="divide-y divide-notion-border bg-white">
        {tools.map((t) => (
          <div key={t.id} className="px-2 py-1">
            <ToolCallCard content={t.content as any} status={t.status ?? undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}
