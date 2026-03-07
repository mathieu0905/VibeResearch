import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node } from '@tiptap/pm/model';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const MarkdownExtension = StarterKit.configure({
  heading: { levels: [1, 2, 3] },
});

export function WysiwygEditor({
  value,
  onChange,
  placeholder,
  editable = true,
}: WysiwygEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      MarkdownExtension,
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-full' },
    },
    onUpdate: ({ editor }) => {
      onChange(editorToMarkdown(editor));
    },
  });

  useEffect(() => {
    if (editor && value !== editorToMarkdown(editor)) {
      editor.commands.setContent(markdownToHtml(value));
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={`tiptap-editor h-full overflow-auto ${!editable ? 'readonly' : ''}`}>
      <EditorContent editor={editor} className="h-full p-4" />
    </div>
  );
}

function markdownToHtml(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      line = processInlineFormatting(line);
      if (line.startsWith('<h3>') || line.startsWith('<h2>') || line.startsWith('<h1>'))
        return line;
      if (line.startsWith('> ')) return `<blockquote><p>${line.slice(2)}</p></blockquote>`;
      if (line === '---' || line === '***') return '<hr>';
      if (line === '') return '<p></p>';
      if (line.startsWith('<p>')) return line;
      return `<p>${line}</p>`;
    })
    .join('');
}

function processInlineFormatting(text: string): string {
  if (text.startsWith('### ')) return `<h3>${processInlineFormatting(text.slice(4))}</h3>`;
  if (text.startsWith('## ')) return `<h2>${processInlineFormatting(text.slice(3))}</h2>`;
  if (text.startsWith('# ')) return `<h1>${processInlineFormatting(text.slice(2))}</h1>`;
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

function editorToMarkdown(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return '';
  const doc = editor.state.doc;
  const lines: string[] = [];

  doc.descendants((node: Node) => {
    if (node.isText) {
      lines.push(node.text || '');
      return false;
    }
    if (node.type.name === 'heading') {
      lines.push('#'.repeat(node.attrs.level) + ' ' + node.textContent, '');
      return false;
    }
    if (node.type.name === 'paragraph') {
      lines.push(node.textContent, '');
      return false;
    }
    if (node.type.name === 'blockquote') {
      lines.push('> ' + node.textContent.split('\n').join('\n> '), '');
      return false;
    }
    if (node.type.name === 'bulletList') return true;
    if (node.type.name === 'listItem') {
      lines.push('- ' + node.textContent);
      return false;
    }
    if (node.type.name === 'orderedList') return true;
    if (node.type.name === 'horizontalRule') {
      lines.push('---', '');
      return false;
    }
    return true;
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
