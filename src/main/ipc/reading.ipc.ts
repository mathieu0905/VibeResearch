import { ipcMain } from 'electron';
import { ReadingService } from '../services/reading.service';

const readingService = new ReadingService();

export function setupReadingIpc() {
  ipcMain.handle('reading:create', async (_, input) => {
    return readingService.create(input);
  });

  ipcMain.handle('reading:update', async (_, id: string, content: Record<string, unknown>) => {
    return readingService.update(id, content);
  });

  ipcMain.handle('reading:getById', async (_, id: string) => {
    return readingService.getById(id);
  });

  ipcMain.handle('reading:listByPaper', async (_, paperId: string) => {
    return readingService.listByPaper(paperId);
  });

  ipcMain.handle(
    'reading:saveChat',
    async (_, input: { paperId: string; noteId: string | null; messages: unknown[] }) => {
      return readingService.saveChat(input);
    },
  );

  ipcMain.handle(
    'reading:aiEdit',
    async (
      _,
      input: {
        paperId: string;
        instruction: string;
        currentNotes: Record<string, string>;
        pdfUrl?: string;
      },
    ) => {
      return readingService.aiEditNotes(input);
    },
  );
}
