import { PdfViewerZoomable } from './pdf-viewer-zoomable';

interface PdfViewerProps {
  /** Local file path (not URL) */
  path: string;
  /** Callback when file is not found, allowing parent to show download UI */
  onFileNotFound?: () => void;
}

export function PdfViewer({ path, onFileNotFound }: PdfViewerProps) {
  return <PdfViewerZoomable path={path} onFileNotFound={onFileNotFound} />;
}
