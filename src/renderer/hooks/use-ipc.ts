/**
 * IPC client for the renderer process.
 * Replaces apps/web/src/components/api-client.ts
 */

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
      once: (channel: string, listener: (...args: unknown[]) => void) => void;
      readLocalFile: (path: string) => Promise<string>;
    };
  }
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.electronAPI.invoke(channel, ...args) as Promise<T>;
}

export type ImportPhase =
  | 'idle'
  | 'scanning'
  | 'parsing_history'
  | 'upserting_papers'
  | 'downloading_pdfs'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ImportStatus {
  active: boolean;
  total: number;
  completed: number;
  success: number;
  failed: number;
  skipped: number;
  phase: ImportPhase;
  message: string;
  lastImportAt: string | null;
  lastImportCount: number;
}

export interface ScanResult {
  papers: Array<{ arxivId: string; title: string; url: string }>;
  newCount: number;
  existingCount: number;
}

export interface PaperItem {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  tagNames?: string[];
  pdfUrl?: string;
  pdfPath?: string;
  sourceUrl?: string;
  rating?: number | null;
  createdAt?: string;
  lastReadAt?: string | null;
}

export interface AgenticSearchStep {
  type: 'thinking' | 'searching' | 'found' | 'done';
  message: string;
  keywords?: string[];
  foundCount?: number;
}

export interface AgenticSearchPaper {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  year?: number;
  tagNames?: string[];
  abstract?: string;
  relevanceReason?: string;
}

export interface AgenticSearchResult {
  steps: AgenticSearchStep[];
  papers: AgenticSearchPaper[];
}

export interface ReadingNote {
  id: string;
  title: string;
  contentJson: string;
  content: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTodo {
  id: string;
  projectId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRepo {
  id: string;
  projectId: string;
  repoUrl: string;
  localPath?: string | null;
  clonedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIdea {
  id: string;
  projectId: string;
  title: string;
  content: string;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string | null;
  todos: ProjectTodo[];
  repos: ProjectRepo[];
  ideas: ProjectIdea[];
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface CloneResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  baseURL?: string;
  enabled: boolean;
  hasApiKey?: boolean;
}

export interface CliTool {
  name: string;
  displayName: string;
  command: string;
  isInstalled: boolean;
  version?: string;
}

export type ProviderKind = 'anthropic' | 'openai' | 'gemini' | 'custom';

export type ModelKind = 'agent' | 'lightweight' | 'chat';
export type ModelBackend = 'api' | 'cli';

export interface ModelConfig {
  id: string;
  name: string;
  kind: ModelKind;
  backend: ModelBackend;
  provider?: 'anthropic' | 'openai' | 'gemini' | 'custom';
  model?: string;
  baseURL?: string;
  command?: string;
  envVars?: string;
  hasApiKey?: boolean;
}

export interface CliConfig {
  id: string;
  name: string;
  command: string;
  envVars: string;
  provider: ProviderKind;
  active: boolean;
}

export const ipc = {
  // Papers
  listPapers: (query?: {
    q?: string;
    year?: number;
    tag?: string;
    importedWithin?: 'today' | 'week' | 'month' | 'all';
  }) => invoke<PaperItem[]>('papers:list', query ?? {}),
  listTodayPapers: () => invoke<PaperItem[]>('papers:listToday'),
  createPaper: (input: Record<string, unknown>) => invoke<PaperItem>('papers:create', input),
  downloadPaper: (input: string, tags?: string[]) =>
    invoke<{
      paper: PaperItem;
      download: { success: boolean; size: number; skipped: boolean };
      existed: boolean;
    }>('papers:download', input, tags),
  getPaper: (id: string) => invoke<PaperItem>('papers:getById', id),
  getPaperByShortId: (shortId: string) => invoke<PaperItem>('papers:getByShortId', shortId),
  downloadPdf: (paperId: string, pdfUrl: string) =>
    invoke<{ pdfPath: string; size: number; skipped: boolean }>(
      'papers:downloadPdf',
      paperId,
      pdfUrl,
    ),
  deletePaper: (id: string) => invoke<PaperItem | null>('papers:delete', id),
  deletePapers: (ids: string[]) => invoke<number>('papers:deleteMany', ids),
  touchPaper: (id: string) => invoke<void>('papers:touch', id),
  fixUrlTitles: () => invoke<{ fixed: number; failed: number }>('papers:fixUrlTitles'),
  addArxivIdPrefix: () => invoke<{ updated: number }>('papers:addArxivIdPrefix'),
  updatePaperTags: (id: string, tags: string[]) => invoke<PaperItem>('papers:updateTags', id, tags),
  updatePaperRating: (id: string, rating: number | null) =>
    invoke<PaperItem>('papers:updateRating', id, rating),
  listAllTags: () => invoke<string[]>('papers:listTags'),
  agenticSearch: (query: string) => invoke<AgenticSearchResult>('papers:agenticSearch', query),

  // Reading
  listReading: (paperId: string) => invoke<ReadingNote[]>('reading:listByPaper', paperId),
  createReading: (input: Record<string, unknown>) => invoke<ReadingNote>('reading:create', input),
  updateReading: (id: string, content: Record<string, unknown>) =>
    invoke<ReadingNote>('reading:update', id, content),
  getReading: (id: string) => invoke<ReadingNote>('reading:getById', id),
  saveChat: (input: { paperId: string; noteId: string | null; messages: unknown[] }) =>
    invoke<{ id: string }>('reading:saveChat', input),
  aiEditNotes: (input: {
    paperId: string;
    instruction: string;
    currentNotes: Record<string, string>;
    pdfUrl?: string;
  }) => invoke<Record<string, string>>('reading:aiEdit', input),

  // Projects
  listProjects: () => invoke<ProjectItem[]>('projects:list'),
  createProject: (input: { name: string; description?: string }) =>
    invoke<ProjectItem>('projects:create', input),
  updateProject: (id: string, data: { name?: string; description?: string }) =>
    invoke<ProjectItem>('projects:update', id, data),
  deleteProject: (id: string) => invoke<ProjectItem>('projects:delete', id),
  touchProject: (id: string) => invoke<void>('projects:touch', id),

  createTodo: (input: { projectId: string; text: string }) =>
    invoke<ProjectTodo>('projects:todo:create', input),
  updateTodo: (id: string, data: { text?: string; done?: boolean }) =>
    invoke<ProjectTodo>('projects:todo:update', id, data),
  deleteTodo: (id: string) => invoke<ProjectTodo>('projects:todo:delete', id),

  addRepo: (input: { projectId: string; repoUrl: string }) =>
    invoke<ProjectRepo>('projects:repo:add', input),
  cloneRepo: (repoId: string, repoUrl: string) =>
    invoke<CloneResult>('projects:repo:clone', repoId, repoUrl),
  getCommits: (localPath: string, limit?: number) =>
    invoke<CommitInfo[]>('projects:repo:commits', localPath, limit),
  deleteRepo: (id: string) => invoke<ProjectRepo>('projects:repo:delete', id),

  createProjectIdea: (input: {
    projectId: string;
    title: string;
    content: string;
    paperIds?: string[];
  }) => invoke<ProjectIdea>('projects:idea:create', input),
  deleteProjectIdea: (id: string) => invoke<ProjectIdea>('projects:idea:delete', id),

  // Ingest
  importChromeHistoryFromFile: (filePath: string) =>
    invoke<{ imported: number; previewTitles: string[] }>('ingest:chromeHistoryFromFile', filePath),
  importChromeHistoryAuto: (days: number | null = 1) =>
    invoke<{ imported: number; previewTitles: string[] }>('ingest:chromeHistoryAuto', days),
  scanLocalPapersDir: (dir: string) => invoke<{ started: boolean }>('ingest:scanLocalDir', dir),
  getImportStatus: () => invoke<ImportStatus>('ingest:status'),
  // New scan/import flow
  scanChromeHistory: (days: number | null = 1) => invoke<ScanResult>('ingest:scan', days),
  importScannedPapers: (papers: ScanResult['papers']) =>
    invoke<{ started: boolean }>('ingest:importScanned', papers),
  cancelImport: () => invoke<{ cancelled: boolean }>('ingest:cancel'),

  // Providers
  listProviders: () => invoke<ProviderConfig[]>('providers:list'),
  saveProvider: (config: Record<string, unknown>) =>
    invoke<{ success: boolean }>('providers:save', config),
  getActiveProvider: () => invoke<string>('providers:getActive'),
  setActiveProvider: (id: string) => invoke<{ success: boolean }>('providers:setActive', id),

  // App settings
  getSettings: () => invoke<{ papersDir: string; editorCommand: string }>('settings:get'),
  setPapersDir: (dir: string) => invoke<{ success: boolean }>('settings:setPapersDir', dir),
  setEditor: (cmd: string) => invoke<{ success: boolean }>('settings:setEditor', cmd),
  selectFolder: () => invoke<string | null>('settings:selectFolder'),

  // Shell
  openInEditor: (dirPath: string) =>
    invoke<{ success: boolean; error?: string }>('shell:openInEditor', dirPath),

  // CLI tools
  detectCliTools: () => invoke<CliTool[]>('cli:detect'),
  testCli: (command: string, extraArgs?: string, envVars?: string) =>
    invoke<{ success: boolean; output?: string; error?: string }>(
      'cli:test',
      command,
      extraArgs,
      envVars,
    ),
  runCli: (options: {
    tool: string;
    args: string[];
    sessionId: string;
    cwd?: string;
    envVars?: string;
  }) => invoke<{ sessionId: string; started: boolean }>('cli:run', options),
  killCli: (sessionId: string) => invoke<{ killed: boolean }>('cli:kill', sessionId),

  // CLI tools config (persisted in ~/.vibe-research/)
  listCliConfigs: () => invoke<CliConfig[]>('cliTools:list'),
  saveCliConfigs: (tools: CliConfig[]) => invoke<{ success: boolean }>('cliTools:save', tools),

  // Models (new unified config)
  listModels: () => invoke<ModelConfig[]>('models:list'),
  getActiveModelIds: () => invoke<Record<ModelKind, string | null>>('models:getActiveIds'),
  getActiveModel: (kind: ModelKind) => invoke<ModelConfig | null>('models:getActive', kind),
  saveModel: (config: Omit<ModelConfig, 'hasApiKey'> & { apiKey?: string }) =>
    invoke<{ success: boolean }>('models:save', config),
  deleteModel: (id: string) => invoke<{ success: boolean }>('models:delete', id),
  setActiveModel: (kind: ModelKind, id: string) =>
    invoke<{ success: boolean }>('models:setActive', kind, id),
  testSavedModelConnection: (id: string) => invoke<{ success: boolean; error?: string }>('models:testSavedConnection', id),
  testModelConnection: (params: {
    provider: 'anthropic' | 'openai' | 'gemini' | 'custom';
    model: string;
    apiKey?: string;
    baseURL?: string;
  }) => invoke<{ success: boolean; error?: string }>('models:testConnection', params),
};

/** Subscribe to IPC events from main process */
export function onIpc(channel: string, listener: (...args: unknown[]) => void): () => void {
  return window.electronAPI.on(channel, listener);
}
