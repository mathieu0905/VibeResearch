import { ipcMain, BrowserWindow } from 'electron';
import { ChatService } from '../services/chat.service';
import { type IpcResult, ok, err } from '@shared';

// Lazy instantiation to ensure DATABASE_URL is set before Prisma initializes
let svc: ChatService | null = null;

function getChatService() {
  if (!svc) svc = new ChatService();
  return svc;
}

// Track active chat streams for cancellation
const activeChatStreams = new Map<string, AbortController>();

export function setupChatIpc() {
  // ── Sessions ──────────────────────────────────────────────────────────────

  ipcMain.handle(
    'chat:session:create',
    async (
      _,
      input: {
        projectId: string;
        title: string;
        paperIds?: string[];
        repoIds?: string[];
      },
    ): Promise<IpcResult<unknown>> => {
      try {
        const result = await getChatService().createSession(input);
        return ok(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[chat:session:create] Error:', msg);
        return err(msg);
      }
    },
  );

  ipcMain.handle('chat:session:list', async (_, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await getChatService().listSessionsByProject(projectId);
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat:session:list] Error:', msg);
      return err(msg);
    }
  });

  ipcMain.handle('chat:session:get', async (_, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await getChatService().getSession(id);
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat:session:get] Error:', msg);
      return err(msg);
    }
  });

  ipcMain.handle(
    'chat:session:updateTitle',
    async (_, id: string, title: string): Promise<IpcResult<unknown>> => {
      try {
        const result = await getChatService().updateSessionTitle(id, title);
        return ok(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[chat:session:updateTitle] Error:', msg);
        return err(msg);
      }
    },
  );

  ipcMain.handle('chat:session:delete', async (_, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await getChatService().deleteSession(id);
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat:session:delete] Error:', msg);
      return err(msg);
    }
  });

  // ── Messages ──────────────────────────────────────────────────────────────

  ipcMain.handle(
    'chat:message:add',
    async (
      _,
      input: {
        sessionId: string;
        role: 'user' | 'assistant';
        content: string;
      },
    ): Promise<IpcResult<unknown>> => {
      try {
        const result = await getChatService().addMessage(input);
        return ok(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[chat:message:add] Error:', msg);
        return err(msg);
      }
    },
  );

  ipcMain.handle('chat:message:list', async (_, sessionId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await getChatService().getMessagesBySession(sessionId);
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat:message:list] Error:', msg);
      return err(msg);
    }
  });

  // ── Streaming Chat ────────────────────────────────────────────────────────

  ipcMain.handle(
    'chat:stream',
    async (
      event,
      input: {
        streamId: string;
        sessionId: string;
        projectId: string;
        paperIds: string[];
        repoIds?: string[];
        messages: { role: 'user' | 'assistant'; content: string }[];
      },
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { error: 'No window found' };

      // Cancel any existing stream with same ID
      const existing = activeChatStreams.get(input.streamId);
      if (existing) existing.abort();

      const controller = new AbortController();
      activeChatStreams.set(input.streamId, controller);

      try {
        await getChatService().chat(
          {
            sessionId: input.sessionId,
            projectId: input.projectId,
            paperIds: input.paperIds,
            repoIds: input.repoIds,
            messages: input.messages,
          },
          (chunk) => {
            win.webContents.send('chat:output', input.streamId, chunk);
          },
          controller.signal,
        );
        win.webContents.send('chat:done', input.streamId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[chat:stream] Error:', msg);
        win.webContents.send('chat:error', input.streamId, msg);
      } finally {
        activeChatStreams.delete(input.streamId);
      }

      return { streamId: input.streamId, started: true };
    },
  );

  ipcMain.handle('chat:kill', async (_, streamId: string) => {
    const controller = activeChatStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeChatStreams.delete(streamId);
      return { killed: true };
    }
    return { killed: false };
  });

  // ── Title Generation ──────────────────────────────────────────────────────

  ipcMain.handle('chat:generateTitle', async (_, content: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await getChatService().generateTitleFromMessage(content);
      return ok(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[chat:generateTitle] Error:', msg);
      return err(msg);
    }
  });
}
