/**
 * Mock data and utilities for chat-related tests
 */
import { vi } from 'vitest';
import { mockIPCResponse } from './render-utils';

// Mock chat sessions based on database schema
export const mockChatSessions = [
  {
    id: 'session-1',
    projectId: 'project-1',
    title: 'Neural Network Research',
    paperIds: ['paper-1', 'paper-2'],
    repoIds: ['repo-1'],
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'session-2',
    projectId: 'project-1',
    title: 'Paper Analysis Discussion',
    paperIds: ['paper-3'],
    repoIds: [],
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 'session-3',
    projectId: 'project-1',
    title: 'New Chat',
    paperIds: [],
    repoIds: ['repo-2', 'repo-3'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock chat messages based on database schema
export const mockChatMessages = [
  {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user' as const,
    content: 'Can you explain the key findings of the transformer paper?',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'assistant' as const,
    content:
      'The transformer paper introduces a novel architecture based solely on attention mechanisms...',
    createdAt: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 'msg-3',
    sessionId: 'session-1',
    role: 'user' as const,
    content: 'What are the advantages over RNNs?',
    createdAt: new Date(Date.now() - 3400000).toISOString(),
  },
  {
    id: 'msg-4',
    sessionId: 'session-1',
    role: 'assistant' as const,
    content:
      'Transformers offer several advantages: 1) Parallelization during training, 2) Better long-range dependencies...',
    createdAt: new Date(Date.now() - 3300000).toISOString(),
  },
];

// Mock extracted task result
export const mockExtractedTask = {
  title: 'Implement Transformer Model',
  prompt:
    'Create a Python implementation of the Transformer architecture based on the "Attention Is All You Need" paper. Include the multi-head attention mechanism, positional encoding, and the encoder-decoder structure.',
};

/**
 * Setup mock IPC responses for chat operations
 */
export function setupChatMocks() {
  // Session operations
  mockIPCResponse('chat:session:list', mockChatSessions);
  mockIPCResponse('chat:session:create', {
    id: 'new-session-id',
    projectId: 'project-1',
    title: 'New Chat',
    paperIdsJson: '[]',
    repoIdsJson: '[]',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  mockIPCResponse('chat:session:get', mockChatSessions[0]);
  mockIPCResponse('chat:session:updateTitle', { success: true });
  mockIPCResponse('chat:session:delete', { success: true });

  // Message operations
  mockIPCResponse('chat:message:list', mockChatMessages);
  mockIPCResponse('chat:message:add', { success: true });

  // Stream operations
  mockIPCResponse('chat:stream', { streamId: 'test-stream-id', started: true });
  mockIPCResponse('chat:kill', { killed: true });

  // Title generation
  mockIPCResponse('chat:generateTitle', 'Generated Chat Title');

  // Task extraction
  mockIPCResponse('chat:extractTask', mockExtractedTask);
}

/**
 * Simulate receiving chat stream events
 * Uses window.electronAPI which is set up by frontend-setup.ts
 */
export function simulateChatStream(
  callbacks: {
    onOutput?: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  },
  chunks: string[] = ['Hello', ' ', 'world', '!'],
  delay = 10,
) {
  // window.electronAPI is set by frontend-setup.ts beforeEach
  const mockElectronAPI = window.electronAPI as {
    on: ReturnType<typeof vi.fn>;
  };

  // Mock the onIpc to trigger stream events
  let outputHandler: ((...args: unknown[]) => void) | null = null;
  let doneHandler: ((...args: unknown[]) => void) | null = null;
  let errorHandler: ((...args: unknown[]) => void) | null = null;

  mockElectronAPI.on.mockImplementation(
    (channel: string, handler: (...args: unknown[]) => void) => {
      if (channel === 'chat:output') outputHandler = handler;
      if (channel === 'chat:done') doneHandler = handler;
      if (channel === 'chat:error') errorHandler = handler;
      return () => {};
    },
  );

  // Simulate streaming
  setTimeout(async () => {
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      outputHandler?.('test-stream-id', chunk);
      callbacks.onOutput?.(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    doneHandler?.('test-stream-id');
    callbacks.onDone?.();
  }, 0);

  return {
    triggerError: (error: string) => {
      errorHandler?.('test-stream-id', error);
      callbacks.onError?.(error);
    },
  };
}
