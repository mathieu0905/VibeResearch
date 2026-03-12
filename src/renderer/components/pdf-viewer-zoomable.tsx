import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerZoomableProps {
  /** Local file path (not URL) */
  path: string;
  /** Callback when file is not found, allowing parent to show download UI */
  onFileNotFound?: () => void;
}

export function PdfViewerZoomable({ path, onFileNotFound }: PdfViewerZoomableProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [scale, setScale] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onFileNotFoundRef = useRef(onFileNotFound);
  const cleanupRef = useRef<(() => void) | null>(null);
  const scaleRef = useRef(scale);

  // Update refs
  useEffect(() => {
    onFileNotFoundRef.current = onFileNotFound;
  }, [onFileNotFound]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Load PDF data
  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      // Cleanup previous blob URL
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      try {
        const filePath = path.replace(/^local-file:\/\//, '');
        if (!window.electronAPI) {
          throw new Error('Electron file API unavailable');
        }
        const base64 = await window.electronAPI.readLocalFile(filePath);
        if (!isMounted) return;

        // Convert base64 to Uint8Array
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Create blob URL to avoid ArrayBuffer detachment issues
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        cleanupRef.current = () => URL.revokeObjectURL(url);
        setPdfUrl(url);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        const errorMsg = err instanceof Error ? err.message : 'Failed to load PDF';
        if (errorMsg === 'File not found' && onFileNotFoundRef.current) {
          onFileNotFoundRef.current();
          return;
        }
        setError(errorMsg);
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [path]);

  // Handle wheel event for zooming (trackpad pinch gesture)
  // Use native addEventListener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if it's a pinch gesture (ctrlKey is set for pinch on trackpad)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Pinch zoom
        const delta = -e.deltaY;
        const zoomFactor = delta > 0 ? 1.05 : 0.95;

        setScale((prevScale) => {
          const newScale = Math.max(0.5, Math.min(5.0, prevScale * zoomFactor));
          return newScale;
        });
      }
      // Allow normal scroll to pass through for page navigation
    };

    // CRITICAL: { passive: false } allows preventDefault to work
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Page navigation
  const goToPrevPage = useCallback(() => {
    setPageNum((prev) => {
      const newPage = Math.max(1, prev - 1);
      setPageInputValue(String(newPage));
      return newPage;
    });
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNum((prev) => {
      const newPage = Math.min(numPages, prev + 1);
      setPageInputValue(String(newPage));
      return newPage;
    });
  }, [numPages]);

  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(numPages, page));
      setPageNum(clampedPage);
      setPageInputValue(String(clampedPage));
    },
    [numPages],
  );

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  }, []);

  const handlePageInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const page = parseInt(pageInputValue, 10);
      if (!isNaN(page)) {
        goToPage(page);
      } else {
        setPageInputValue(String(pageNum));
      }
    },
    [pageInputValue, pageNum, goToPage],
  );

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      setPageInputValue(String(pageNum));
    }
  }, [pageInputValue, pageNum, goToPage]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(5.0, prev * 1.2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, prev / 1.2));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  // Search functionality
  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
    if (showSearch) {
      setSearchQuery('');
    }
  }, [showSearch]);

  // Handle Ctrl+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNum(1);
    setPageInputValue('1');
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#525659]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#525659] p-4">
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#525659]">
      {/* Controls */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm">
        <button
          onClick={goToPrevPage}
          disabled={pageNum <= 1}
          className="rounded px-2 py-1 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          ←
        </button>
        <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
          <input
            type="text"
            value={pageInputValue}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            className="w-12 rounded bg-white/10 px-2 py-1 text-center text-sm text-white focus:bg-white/20 focus:outline-none"
          />
          <span className="px-1 text-sm text-white/70">/ {numPages}</span>
        </form>
        <button
          onClick={goToNextPage}
          disabled={pageNum >= numPages}
          className="rounded px-2 py-1 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          →
        </button>
      </div>

      <div className="absolute right-4 top-4 z-10 flex gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm">
        <button
          onClick={toggleSearch}
          className="rounded px-2 py-1 text-sm text-white hover:bg-white/10"
          title="Search (Ctrl+F)"
        >
          🔍
        </button>
        <button
          onClick={zoomOut}
          className="rounded px-2 py-1 text-sm text-white hover:bg-white/10"
        >
          −
        </button>
        <span className="px-2 py-1 text-sm text-white">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} className="rounded px-2 py-1 text-sm text-white hover:bg-white/10">
          +
        </button>
        <button
          onClick={resetZoom}
          className="rounded px-2 py-1 text-sm text-white hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in PDF..."
            className="w-64 rounded bg-white/10 px-3 py-1 text-sm text-white placeholder-white/50 focus:bg-white/20 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="rounded px-2 py-1 text-sm text-white hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      {/* PDF container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-auto"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <div className="flex min-h-full items-center justify-center p-8">
          <div
            ref={contentRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center top',
            }}
          >
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </div>
                }
              >
                <Page
                  pageNumber={pageNum}
                  scale={1.0}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
