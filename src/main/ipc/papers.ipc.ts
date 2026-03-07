import { ipcMain } from 'electron';
import { PapersService } from '../services/papers.service';
import { DownloadService } from '../services/download.service';
import { AgenticSearchService, type AgenticSearchStep } from '../services/agentic-search.service';

const papersService = new PapersService();
const downloadService = new DownloadService();
const agenticSearchService = new AgenticSearchService();

export function setupPapersIpc() {
  ipcMain.handle('papers:download', async (_, input: string, tags?: string[]) => {
    return downloadService.downloadFromInput(input, tags ?? []);
  });
  ipcMain.handle(
    'papers:list',
    async (
      _,
      query: {
        q?: string;
        year?: number;
        tag?: string;
        importedWithin?: 'today' | 'week' | 'month' | 'all';
      } = {},
    ) => {
      return papersService.list(query);
    },
  );

  ipcMain.handle('papers:listToday', async () => {
    return papersService.listToday();
  });

  ipcMain.handle('papers:create', async (_, input) => {
    return papersService.create(input);
  });

  ipcMain.handle('papers:getById', async (_, id: string) => {
    return papersService.getById(id);
  });

  ipcMain.handle('papers:getByShortId', async (_, shortId: string) => {
    return papersService.getByShortId(shortId);
  });

  ipcMain.handle('papers:downloadPdf', async (_, paperId: string, pdfUrl: string) => {
    return papersService.downloadPdf(paperId, pdfUrl);
  });

  ipcMain.handle('papers:delete', async (_, id: string) => {
    return papersService.deleteById(id);
  });

  ipcMain.handle('papers:deleteMany', async (_, ids: string[]) => {
    return papersService.deleteMany(ids);
  });

  ipcMain.handle('papers:touch', async (_, id: string) => {
    return papersService.touchLastRead(id);
  });

  ipcMain.handle('papers:fixUrlTitles', async () => {
    return papersService.fixUrlTitles();
  });

  ipcMain.handle('papers:addArxivIdPrefix', async () => {
    return papersService.addArxivIdPrefix();
  });

  ipcMain.handle('papers:updateTags', async (_, id: string, tags: string[]) => {
    return papersService.updateTags(id, tags);
  });

  ipcMain.handle('papers:updateRating', async (_, id: string, rating: number | null) => {
    return papersService.updateRating(id, rating);
  });

  ipcMain.handle('papers:listTags', async () => {
    return papersService.listAllTags();
  });

  // Agentic Search with streaming steps
  ipcMain.handle('papers:agenticSearch', async (event, query: string) => {
    const steps: AgenticSearchStep[] = [];

    const result = await agenticSearchService.search(query, (step) => {
      steps.push(step);
      // Send step updates to renderer via IPC event
      event.sender.send('papers:agenticSearch:step', step);
    });

    return { steps: result.steps, papers: result.papers };
  });
}
