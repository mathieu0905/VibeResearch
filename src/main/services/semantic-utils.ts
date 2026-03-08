export interface TextChunk {
  chunkIndex: number;
  content: string;
  contentPreview: string;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function splitTextIntoChunks(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {},
): TextChunk[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunkSize = Math.max(400, options.chunkSize ?? 1600);
  const overlap = Math.max(0, Math.min(chunkSize / 2, options.overlap ?? 220));
  const chunks: TextChunk[] = [];

  let buffer = '';
  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({
      chunkIndex: chunks.length,
      content,
      contentPreview: normalizeWhitespace(content).slice(0, 240),
    });
  };

  for (const section of normalized) {
    const candidate = buffer ? `${buffer}\n\n${section}` : section;
    if (candidate.length <= chunkSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      flush();
      const tail = buffer.slice(Math.max(0, buffer.length - overlap)).trim();
      buffer = tail ? `${tail}\n\n${section}` : section;
      if (buffer.length <= chunkSize) {
        continue;
      }
    }

    let start = 0;
    while (start < section.length) {
      const end = Math.min(section.length, start + chunkSize);
      const slice = section.slice(start, end).trim();
      if (slice) {
        chunks.push({
          chunkIndex: chunks.length,
          content: slice,
          contentPreview: normalizeWhitespace(slice).slice(0, 240),
        });
      }
      if (end >= section.length) {
        buffer = '';
        break;
      }
      start = Math.max(end - overlap, start + 1);
    }
  }

  if (buffer) {
    flush();
  }

  return chunks;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return -1;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }

  if (leftNorm === 0 || rightNorm === 0) return -1;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
