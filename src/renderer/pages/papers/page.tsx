import { useState, useCallback, useEffect } from 'react';
import { PapersByTag } from '../../components/papers-by-tag';
import { ipc, onIpc, type ImportStatus } from '../../hooks/use-ipc';
import { ImportModal } from '../../components/import-modal';
import { Download, Loader2 } from 'lucide-react';

export function PapersPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // on mount, fetch current status in case import is already running
  useEffect(() => {
    ipc
      .getImportStatus()
      .then((status) => {
        setImportStatus(status);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsub = onIpc('ingest:status', (...args) => {
      const status = args[1] as ImportStatus;
      setImportStatus(status);
      if (!status.active) setRefreshKey((k) => k + 1);
    });
    return unsub;
  }, []);

  const isImporting = importStatus?.active;

  const handleImported = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-notion-border px-8 py-5">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-notion-text">Library</h1>
          <p className="mt-0.5 text-sm text-notion-text-secondary">Browse papers by tag</p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-notion-border bg-white px-3 py-2 text-sm font-medium text-notion-text shadow-sm transition-colors hover:bg-notion-sidebar disabled:opacity-50"
        >
          {isImporting ? (
            <Loader2 size={14} className="animate-spin text-blue-500" />
          ) : (
            <Download size={14} className="text-notion-text-secondary" />
          )}
          {isImporting ? 'Importing…' : 'Import'}
        </button>
      </div>

      {/* Import progress banner */}
      {importStatus?.active && (
        <div className="flex-shrink-0 flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-8 py-2.5">
          <Loader2 size={14} className="animate-spin text-blue-600" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-900">
              {importStatus.phase === 'parsing_history' && 'Parsing Chrome history…'}
              {importStatus.phase === 'upserting_papers' &&
                `Importing papers… ${importStatus.completed}/${importStatus.total}`}
              {importStatus.phase === 'downloading_pdfs' &&
                `Downloading PDFs… ${importStatus.completed}/${importStatus.total}`}
            </span>
          </div>
          {importStatus.total > 0 && (
            <div className="w-32 h-1.5 overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width: `${Math.round((importStatus.completed / importStatus.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <PapersByTag key={refreshKey} />
      </div>

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onImported={handleImported} />
      )}
    </div>
  );
}
