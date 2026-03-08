import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface ThoughtBlockProps {
  content: { text: string };
}

export function ThoughtBlock({ content }: ThoughtBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-left text-xs text-notion-text-tertiary hover:text-notion-text-secondary transition-colors"
      >
        <Brain size={12} className="flex-shrink-0" />
        <span className="font-medium">Thinking...</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 pl-3 border-l-2 border-notion-border">
              <p className="text-xs italic text-notion-text-tertiary whitespace-pre-wrap leading-relaxed">
                {content.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
