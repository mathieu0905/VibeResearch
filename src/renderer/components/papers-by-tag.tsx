import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ipc, type PaperItem } from '../hooks/use-ipc';
import {
  FileText,
  Loader2,
  Trash2,
  Tag,
  Download,
  X,
  ChevronDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EXCLUDED_TAGS = ['arxiv', 'chrome', 'manual', 'pdf'];

type ImportTimeFilter = 'all' | 'today' | 'week' | 'month';

const TIME_FILTER_OPTIONS: { value: ImportTimeFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const tagColors = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', selectedBg: 'bg-blue-600' },
  {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    selectedBg: 'bg-green-600',
  },
  {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    selectedBg: 'bg-orange-500',
  },
  {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    selectedBg: 'bg-purple-600',
  },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', selectedBg: 'bg-pink-500' },
  {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    selectedBg: 'bg-yellow-500',
  },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', selectedBg: 'bg-cyan-600' },
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', selectedBg: 'bg-red-500' },
];

function getTagColorStyle(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tagColors[Math.abs(hash) % tagColors.length];
}

interface TagStat {
  name: string;
  count: number;
}

function buildTagList(papers: PaperItem[]): TagStat[] {
  const tagCounts = new Map<string, number>();

  papers.forEach((paper) => {
    const tags = (paper.tagNames || []).filter((t) => !EXCLUDED_TAGS.includes(t.toLowerCase()));
    if (tags.length === 0) {
      tagCounts.set('Untagged', (tagCounts.get('Untagged') || 0) + 1);
    } else {
      tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    }
  });

  return Array.from(tagCounts.entries())
    .sort(([a], [b]) => {
      if (a === 'Untagged') return 1;
      if (b === 'Untagged') return -1;
      return a.localeCompare(b);
    })
    .map(([name, count]) => ({ name, count }));
}

export function PapersByTag() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [importTimeFilter, setImportTimeFilter] = useState<ImportTimeFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);

  // Selection mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const navigate = useNavigate();

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ipc.listPapers();
      setPapers(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Get available years from all papers for filter dropdown
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    papers.forEach((p) => {
      if (p.year) years.add(p.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [papers]);

  // Client-side import time filter
  const importTimeCutoff = useMemo(() => {
    if (importTimeFilter === 'all') return null;
    const now = new Date();
    switch (importTimeFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      default:
        return null;
    }
  }, [importTimeFilter]);

  const handleDelete = useCallback(async (paperId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This action cannot be undone.`)) return;
    setDeleting(paperId);
    try {
      await ipc.deletePaper(paperId);
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch {
      alert('Failed to delete paper');
    } finally {
      setDeleting(null);
    }
  }, []);

  const handleDownloadPdf = useCallback(
    async (paper: PaperItem) => {
      if (!paper.pdfUrl || downloadingPdf === paper.id) return;
      setDownloadingPdf(paper.id);
      try {
        const result = await ipc.downloadPdf(paper.id, paper.pdfUrl);
        setPapers((prev) =>
          prev.map((p) => (p.id === paper.id ? { ...p, pdfPath: result.pdfPath } : p)),
        );
      } catch {
        // silent
      } finally {
        setDownloadingPdf(null);
      }
    },
    [downloadingPdf],
  );

  // Selection mode handlers
  const toggleSelect = useCallback((paperId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(visiblePapers.map((p) => p.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      await ipc.deletePapers(Array.from(selectedIds));
      setPapers((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to delete papers: ${message}`);
    } finally {
      setIsBatchDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [selectedIds]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const tagList = buildTagList(papers);

  // Apply all filters client-side
  const visiblePapers = useMemo(() => {
    return papers.filter((paper) => {
      // Tag filter
      if (selectedTag) {
        const tags = (paper.tagNames || []).filter((t) => !EXCLUDED_TAGS.includes(t.toLowerCase()));
        if (selectedTag === 'Untagged' && tags.length > 0) return false;
        if (selectedTag !== 'Untagged' && !tags.includes(selectedTag)) return false;
      }

      // Import time filter
      if (importTimeCutoff && paper.createdAt) {
        const created = new Date(paper.createdAt);
        if (created < importTimeCutoff) return false;
      }

      // Year filter
      if (yearFilter !== null && paper.year !== yearFilter) return false;

      return true;
    });
  }, [papers, selectedTag, importTimeCutoff, yearFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-notion-text-tertiary" />
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="rounded-xl border border-notion-border py-16 text-center">
        <FileText size={36} strokeWidth={1.2} className="mx-auto mb-3 text-notion-border" />
        <p className="text-sm text-notion-text-tertiary">No papers yet</p>
        <p className="text-xs text-notion-text-tertiary">
          Import from Chrome history or add manually
        </p>
      </div>
    );
  }

  const hasActiveFilters = importTimeFilter !== 'all' || yearFilter !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Unified Filter Bar */}
      <div className="flex flex-col gap-4">
        {/* Row 1: Time + Year filters */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Time filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-notion-text-tertiary uppercase tracking-wide">
              Import Time
            </span>
            <div className="flex items-center gap-1">
              {TIME_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setImportTimeFilter(opt.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    importTimeFilter === opt.value
                      ? 'bg-notion-text text-white'
                      : 'bg-notion-sidebar text-notion-text-secondary hover:bg-notion-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Year filter */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-notion-text-tertiary uppercase tracking-wide">
                Pub Year
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYearFilter(null)}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    yearFilter === null
                      ? 'bg-notion-text text-white'
                      : 'bg-notion-sidebar text-notion-text-secondary hover:bg-notion-border'
                  }`}
                >
                  All
                </button>
                {availableYears.slice(0, 4).map((year) => (
                  <button
                    key={year}
                    onClick={() => setYearFilter(year)}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      yearFilter === year
                        ? 'bg-notion-text text-white'
                        : 'bg-notion-sidebar text-notion-text-secondary hover:bg-notion-border'
                    }`}
                  >
                    {year}
                  </button>
                ))}
                {availableYears.length > 4 && (
                  <select
                    value={yearFilter ?? ''}
                    onChange={(e) =>
                      setYearFilter(e.target.value ? parseInt(e.target.value, 10) : null)
                    }
                    className="rounded-lg border border-notion-border bg-white px-2.5 py-1.5 text-sm text-notion-text-secondary focus:border-notion-text focus:outline-none"
                  >
                    <option value="">More</option>
                    {availableYears.slice(4).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setImportTimeFilter('all');
                setYearFilter(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Row 2: Tag filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-notion-text-tertiary uppercase tracking-wide">
            Tag
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSelectedTag(null)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                selectedTag === null
                  ? 'bg-notion-text text-white'
                  : 'bg-notion-sidebar text-notion-text-secondary hover:bg-notion-border'
              }`}
            >
              All
              <span
                className={`text-xs ${selectedTag === null ? 'text-white/70' : 'text-notion-text-tertiary'}`}
              >
                {papers.length}
              </span>
            </button>
            {tagList.slice(0, 5).map(({ name, count }) => {
              const style = getTagColorStyle(name);
              const isSelected = selectedTag === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedTag(isSelected ? null : name)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? `${style.selectedBg} text-white`
                      : `${style.bg} ${style.text} hover:opacity-80`
                  }`}
                >
                  {name}
                  <span className={`text-xs ${isSelected ? 'text-white/70' : 'opacity-60'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {tagList.length > 5 && (
              <button
                onClick={() => setShowTagModal(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-notion-sidebar px-2.5 py-1.5 text-sm font-medium text-notion-text-secondary transition-colors hover:bg-notion-border"
              >
                More
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 animate-fade-in"
            onClick={() => setShowTagModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-xl animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-notion-border">
              <h3 className="text-base font-semibold text-notion-text">All Tags</h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="p-1 rounded-lg text-notion-text-tertiary hover:bg-notion-sidebar hover:text-notion-text"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-2">
                {tagList.map(({ name, count }) => {
                  const style = getTagColorStyle(name);
                  const isSelected = selectedTag === name;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedTag(isSelected ? null : name);
                        setShowTagModal(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                        isSelected
                          ? `${style.selectedBg} text-white`
                          : `${style.bg} ${style.text} hover:opacity-80`
                      }`}
                    >
                      {name}
                      <span className={`text-xs ${isSelected ? 'text-white/70' : 'opacity-60'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Count line + Select mode toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-notion-text-tertiary">
          {selectedTag ? (
            <>
              <span className="font-medium text-notion-text">{selectedTag}</span>
              {' · '}
            </>
          ) : null}
          {visiblePapers.length} paper{visiblePapers.length !== 1 ? 's' : ''}
        </p>

        {/* Select mode toggle */}
        {!isSelectMode && visiblePapers.length > 0 && (
          <button
            onClick={() => setIsSelectMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-notion-sidebar px-2.5 py-1.5 text-sm font-medium text-notion-text-secondary transition-colors hover:bg-notion-border"
          >
            <CheckSquare size={14} />
            Select
          </button>
        )}
      </div>

      {/* Selection toolbar */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
              <button
                onClick={selectedIds.size === visiblePapers.length ? deselectAll : selectAll}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {selectedIds.size === visiblePapers.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exitSelectMode}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedIds.size === 0 || isBatchDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-notion-text">Delete Papers</h3>
              <p className="mt-2 text-sm text-notion-text-secondary">
                Are you sure you want to delete {selectedIds.size} paper
                {selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-notion-text-secondary transition-colors hover:bg-notion-sidebar"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={isBatchDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isBatchDeleting && <Loader2 size={14} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Papers grid */}
      {visiblePapers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-notion-border py-16 text-center">
          <Tag size={32} strokeWidth={1.2} className="mx-auto mb-3 text-notion-border" />
          <p className="text-sm text-notion-text-tertiary">No papers in this tag</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-notion-border rounded-xl border border-notion-border overflow-hidden">
          {visiblePapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              deleting={deleting}
              downloadingPdf={downloadingPdf}
              onDelete={handleDelete}
              onDownload={handleDownloadPdf}
              onOpen={(shortId) => navigate(`/papers/${shortId}`)}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(paper.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({
  paper,
  deleting,
  downloadingPdf,
  onDelete,
  onDownload,
  onOpen,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: {
  paper: PaperItem;
  deleting: string | null;
  downloadingPdf: string | null;
  onDelete: (id: string, title: string) => void;
  onDownload: (paper: PaperItem) => void;
  onOpen: (shortId: string) => void;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const visibleTags = (paper.tagNames || [])
    .filter((t) => !EXCLUDED_TAGS.includes(t.toLowerCase()))
    .slice(0, 3);

  return (
    <div
      className={`group flex items-center gap-4 bg-white px-5 py-3.5 transition-colors hover:bg-notion-sidebar/50 ${isSelected ? 'bg-blue-50' : ''}`}
    >
      {/* Checkbox (only in select mode) */}
      {isSelectMode && (
        <button onClick={() => onToggleSelect(paper.id)} className="flex-shrink-0">
          {isSelected ? (
            <CheckSquare size={20} className="text-blue-600" />
          ) : (
            <Square size={20} className="text-notion-border" />
          )}
        </button>
      )}

      {/* Clickable row */}
      <button
        onClick={() => (isSelectMode ? onToggleSelect(paper.id) : onOpen(paper.shortId))}
        className="flex min-w-0 flex-1 items-center gap-4 text-left"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <FileText size={16} className="text-blue-500" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-notion-text">{paper.title}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {paper.year && <span className="text-xs text-notion-text-tertiary">{paper.year}</span>}
            {visibleTags.map((tag) => {
              const style = getTagColorStyle(tag);
              return (
                <span
                  key={tag}
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                >
                  {tag}
                </span>
              );
            })}
            {paper.pdfPath && (
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
                PDF
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Action buttons (hidden in select mode) */}
      {!isSelectMode && (
        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!paper.pdfPath && paper.pdfUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(paper);
              }}
              disabled={downloadingPdf === paper.id}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-notion-text-tertiary hover:bg-blue-50 hover:text-blue-600 disabled:opacity-100"
              title="Download PDF"
            >
              {downloadingPdf === paper.id ? (
                <Loader2 size={14} className="animate-spin text-blue-500" />
              ) : (
                <Download size={14} />
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(paper.id, paper.title);
            }}
            disabled={deleting === paper.id}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-notion-text-tertiary hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Delete paper"
          >
            {deleting === paper.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
