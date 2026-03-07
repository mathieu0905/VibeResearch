import { ipcMain } from 'electron';
import {
  importChromeHistoryFromFile,
  importChromeHistoryAuto,
  scanLocalPapersDir,
  scanChromeHistory,
  importScannedPapers,
  cancelImport,
  getImportStatus,
} from '../services/ingest.service';
import type { ScanResult } from '../services/ingest.service';

export function setupIngestIpc() {
  ipcMain.handle('ingest:chromeHistoryFromFile', (_, filePath: string) => {
    // Fire-and-forget — progress is pushed via ingest:status events
    importChromeHistoryFromFile(filePath).catch(() => undefined);
    return { started: true };
  });

  ipcMain.handle('ingest:chromeHistoryAuto', (_, days: number | null = 1) => {
    // Fire-and-forget — progress is pushed via ingest:status events
    importChromeHistoryAuto(days).catch(() => undefined);
    return { started: true };
  });

  ipcMain.handle('ingest:scanLocalDir', (_, dir: string) => {
    scanLocalPapersDir(dir).catch(() => undefined);
    return { started: true };
  });

  // New: Scan Chrome history and return results without importing
  ipcMain.handle('ingest:scan', async (_, days: number | null = 1): Promise<ScanResult> => {
    return scanChromeHistory(days);
  });

  // New: Import papers from a pre-scanned list
  ipcMain.handle('ingest:importScanned', (_, papers: ScanResult['papers']) => {
    importScannedPapers(papers).catch(() => undefined);
    return { started: true };
  });

  // New: Cancel ongoing import
  ipcMain.handle('ingest:cancel', () => {
    cancelImport();
    return { cancelled: true };
  });

  ipcMain.handle('ingest:status', async () => {
    return getImportStatus();
  });
}
