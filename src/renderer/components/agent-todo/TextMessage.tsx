import ReactMarkdown from 'react-markdown';

interface TextMessageProps {
  content: { text: string };
  streaming?: boolean;
}

export function TextMessage({ content, streaming }: TextMessageProps) {
  if (streaming) {
    return (
      <div className="text-sm text-notion-text leading-relaxed whitespace-pre-wrap font-sans">
        {content.text}
        <span className="inline-block w-[2px] h-[1em] bg-notion-accent ml-0.5 align-text-bottom animate-pulse" />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none text-notion-text">
      <ReactMarkdown>{content.text}</ReactMarkdown>
    </div>
  );
}
