import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ipc, onIpc, type DiscoveredPaper } from '../../hooks/use-ipc';
import {
  Sparkles,
  RefreshCw,
  Download,
  ExternalLink,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BookOpen,
  ChevronDown,
  Star,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const COMMON_CATEGORIES = [
  'cs.AI',
  'cs.LG',
  'cs.CL',
  'cs.CV',
  'cs.NE',
  'cs.RO',
  'cs.SE',
  'cs.IR',
  'stat.ML',
];

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600 bg-green-50';
  if (score >= 6) return 'text-blue-600 bg-blue-50';
  if (score >= 4) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

function getRecommendationStyle(rec: string): { bg: string; text: string } {
  switch (rec) {
    case 'must-read':
      return { bg: 'bg-green-100', text: 'text-green-700' };
    case 'worth-reading':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'skimmable':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'skip':
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

export function DiscoveryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [papers, setPapers] = useState<DiscoveredPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateProgress, setEvaluateProgress] = useState<{
    evaluated: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['cs.AI', 'cs.LG']);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [daysBack, setDaysBack] = useState(7);

  const handleFetch = useCallback(async () => {
    if (selectedCategories.length === 0) return;

    setLoading(true);
    setError(null);
    setPapers([]);

    try {
      const result = await ipc.fetchDiscoveryPapers({
        categories: selectedCategories,
        maxResults: 30,
        daysBack,
      });

      if (result.success && result.papers) {
        setPapers(result.papers);
      } else {
        setError(result.error || 'Failed to fetch papers');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, daysBack]);

  const handleEvaluate = useCallback(async () => {
    if (papers.length === 0) return;

    setEvaluating(true);
    setEvaluateProgress({ evaluated: 0, total: papers.length });

    try {
      const result = await ipc.evaluateDiscoveryPapers();
      if (result.success && result.papers) {
        setPapers(result.papers);
      }
    } catch (e) {
      console.error('Evaluation failed:', e);
    } finally {
      setEvaluating(false);
      setEvaluateProgress(null);
    }
  }, [papers.length]);

  // Subscribe to evaluation progress
  useEffect(() => {
    const unsub = onIpc('discovery:evaluateProgress', (_event, progress) => {
      setEvaluateProgress(progress);
    });
    return unsub;
  }, []);

  const handleImport = useCallback(async (paper: DiscoveredPaper) => {
    try {
      await ipc.downloadFromInput(paper.arxivId);
    } catch (e) {
      console.error('Import failed:', e);
    }
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  // Sort papers by quality score (highest first)
  const sortedPapers = [...papers].sort((a, b) => {
    const scoreA = a.qualityScore ?? 0;
    const scoreB = b.qualityScore ?? 0;
    return scoreB - scoreA;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-notion-sidebar">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-notion-border bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <Sparkles size={18} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-notion-text">
                {t('discovery.title', 'Discover Papers')}
              </h1>
              <p className="text-xs text-notion-text-secondary">
                {t('discovery.subtitle', 'Find and evaluate new papers from arXiv')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 rounded-lg border border-notion-border bg-white px-3 py-1.5 text-sm text-notion-text-secondary transition-colors hover:bg-notion-sidebar"
              >
                <Filter size={14} />
                {selectedCategories.length} {t('discovery.categories', 'categories')}
                <ChevronDown size={14} />
              </button>

              <AnimatePresence>
                {showCategoryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-notion-border bg-white p-2 shadow-lg"
                  >
                    {COMMON_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={clsx(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                          selectedCategories.includes(cat)
                            ? 'bg-notion-accent-light text-notion-accent'
                            : 'text-notion-text-secondary hover:bg-notion-sidebar',
                        )}
                      >
                        <div
                          className={clsx(
                            'flex h-4 w-4 items-center justify-center rounded border',
                            selectedCategories.includes(cat)
                              ? 'border-notion-accent bg-notion-accent'
                              : 'border-notion-border',
                          )}
                        >
                          {selectedCategories.includes(cat) && (
                            <CheckCircle2 size={12} className="text-white" />
                          )}
                        </div>
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Days Filter */}
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="rounded-lg border border-notion-border bg-white px-3 py-1.5 text-sm text-notion-text-secondary"
            >
              <option value={1}>{t('discovery.last1Day', 'Last 1 day')}</option>
              <option value={3}>{t('discovery.last3Days', 'Last 3 days')}</option>
              <option value={7}>{t('discovery.last7Days', 'Last 7 days')}</option>
              <option value={14}>{t('discovery.last14Days', 'Last 14 days')}</option>
            </select>

            {/* Fetch Button */}
            <button
              onClick={handleFetch}
              disabled={loading || selectedCategories.length === 0}
              className="flex items-center gap-2 rounded-lg bg-notion-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-notion-accent/90 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('discovery.fetch', 'Fetch Papers')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {papers.length > 0 && !evaluating && papers.some((p) => !p.qualityScore) && (
          <div className="mb-4">
            <button
              onClick={handleEvaluate}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100"
            >
              <Sparkles size={16} />
              {t('discovery.evaluateWithAI', 'Evaluate with AI')}
            </button>
          </div>
        )}

        {evaluating && evaluateProgress && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">
                {t('discovery.evaluating', 'Evaluating papers...')} {evaluateProgress.evaluated}/
                {evaluateProgress.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${(evaluateProgress.evaluated / evaluateProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 size={32} className="animate-spin text-notion-accent" />
              <p className="mt-3 text-sm text-notion-text-secondary">
                {t('discovery.fetching', 'Fetching papers from arXiv...')}
              </p>
            </motion.div>
          ) : papers.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-notion-sidebar">
                <TrendingUp size={28} className="text-notion-text-tertiary" />
              </div>
              <p className="mt-4 text-base text-notion-text-secondary">
                {t('discovery.empty', 'No papers discovered yet')}
              </p>
              <p className="mt-1 text-sm text-notion-text-tertiary">
                {t('discovery.emptyHint', 'Select categories and click "Fetch Papers" to start')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="papers"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4"
            >
              {sortedPapers.map((paper) => (
                <PaperCard
                  key={paper.arxivId}
                  paper={paper}
                  onImport={handleImport}
                  onView={() => window.open(paper.absUrl, '_blank')}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PaperCard({
  paper,
  onImport,
  onView,
}: {
  paper: DiscoveredPaper;
  onImport: (paper: DiscoveredPaper) => void;
  onView: () => void;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={cardVariants}
      className="group rounded-xl border border-notion-border bg-white p-4 transition-all hover:border-notion-accent/30 hover:shadow-md"
    >
      <div className="flex gap-4">
        {/* Quality Score Badge */}
        {paper.qualityScore && (
          <div className="flex flex-col items-center gap-1">
            <div
              className={clsx(
                'flex h-12 w-12 flex-col items-center justify-center rounded-lg',
                getScoreColor(paper.qualityScore),
              )}
            >
              <span className="text-lg font-bold">{paper.qualityScore}</span>
            </div>
            {paper.qualityRecommendation && (
              <span
                className={clsx(
                  'rounded px-1.5 py-0.5 text-xs font-medium',
                  ...Object.values(getRecommendationStyle(paper.qualityRecommendation)),
                )}
              >
                {t(`discovery.${paper.qualityRecommendation}`, paper.qualityRecommendation)}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-notion-text">
              {paper.title}
            </h3>
            <a
              href={paper.absUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-notion-text-tertiary hover:text-notion-accent"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-notion-text-tertiary">
            <span className="truncate">{paper.authors.slice(0, 3).join(', ')}</span>
            {paper.authors.length > 3 && <span>+{paper.authors.length - 3}</span>}
            <span className="text-notion-border">·</span>
            <span>{new Date(paper.publishedAt).toLocaleDateString()}</span>
            <span className="text-notion-border">·</span>
            <span className="rounded bg-notion-sidebar px-1.5 py-0.5">{paper.categories[0]}</span>
          </div>

          {/* AI Reason */}
          {paper.qualityReason && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-notion-text-secondary">
              {paper.qualityReason}
            </p>
          )}

          {/* Quality Dimensions */}
          {paper.qualityDimensions && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(paper.qualityDimensions).map(([key, value]) => (
                <span
                  key={key}
                  className="flex items-center gap-1 rounded bg-notion-sidebar px-1.5 py-0.5 text-xs"
                >
                  <span className="text-notion-text-tertiary">{t(`discovery.${key}`, key)}:</span>
                  <span className="font-medium text-notion-text">{value}</span>
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onImport(paper)}
              className="flex items-center gap-1.5 rounded-lg bg-notion-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-notion-accent/90"
            >
              <Download size={12} />
              {t('discovery.import', 'Import')}
            </button>
            <button
              onClick={onView}
              className="flex items-center gap-1.5 rounded-lg border border-notion-border px-3 py-1 text-xs font-medium text-notion-text-secondary transition-colors hover:bg-notion-sidebar"
            >
              <BookOpen size={12} />
              {t('discovery.viewAbstract', 'View')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
