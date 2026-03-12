import { PdfViewerNative } from './pdf-viewer-native';

interface PdfViewerProps {
  /** Local file path (not URL) */
  path: string;
  /** Callback when file is not found, allowing parent to show download UI */
  onFileNotFound?: () => void;
}

/**
 * PDF viewer using Chrome's native PDF renderer
 * No libraries needed - Chrome handles everything
 */
export function PdfViewer({ path, onFileNotFound }: PdfViewerProps) {
  return <PdfViewerNative path={path} onFileNotFound={onFileNotFound} />;
}
