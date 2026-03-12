import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { onIpc } from './use-ipc';

interface Message {
  id: string;
  msgId: string;
  type: string;
  role: string;
  content: unknown;
  status?: string | null;
  toolCallId?: string | null;
  toolName?: string | null;
  createdAt: string;
}

interface PermissionRequest {
  requestId: number;
  request: {
    options: Array<{ optionId: string; name: string; kind: string }>;
    toolCall: {
      toolCallId: string;
      title: string;
      kind: string;
      rawInput?: Record<string, unknown>;
    };
  };
}

/**
 * Hook for ACP chat streaming.
 * Supports both lightweight (direct LLM) and full ACP agent modes.
 *
 * Uses the same ref-based accumulation pattern as use-agent-stream.ts
 * to prevent text scrambling during rapid chunk arrival.
 */
export function useAcpChatStream(jobId: string, externalJobIdRef?: MutableRefObject<string>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [canSend, setCanSend] = useState<boolean>(true);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);

  // Internal ref updated synchronously during render
  const internalRef = useRef(jobId);
  internalRef.current = jobId;
  const jobIdRef = externalJobIdRef ?? internalRef;

  // === Synchronous message accumulation via refs ===
  const textAccumulatorRef = useRef<Map<string, string>>(new Map());
  const messageMetadataRef = useRef<Map<string, Message>>(new Map());
  const pendingFlushRef = useRef<boolean>(false);

  // Flush accumulated text to React state (batched via requestAnimationFrame)
  const flushToState = useCallback(() => {
    if (pendingFlushRef.current) return;
    pendingFlushRef.current = true;

    requestAnimationFrame(() => {
      pendingFlushRef.current = false;

      const textAcc = textAccumulatorRef.current;
      const metaAcc = messageMetadataRef.current;

      if (textAcc.size === 0) return;

      setMessages((prev) => {
        const updated = [...prev];
        let changed = false;

        for (const [msgId, text] of textAcc) {
          const idx = updated.findIndex((m) => m.msgId === msgId);
          if (idx >= 0) {
            // Update existing message
            updated[idx] = {
              ...updated[idx],
              content: { text },
            };
            changed = true;
          } else {
            // Add new message
            const meta = metaAcc.get(msgId);
            if (meta) {
              updated.push({
                ...meta,
                content: { text },
              });
              changed = true;
            }
          }
        }

        return changed ? updated : prev;
      });
    });
  }, []);

  // Process a stream event
  const processStreamEvent = useCallback(
    (message: Message) => {
      // Handle text/thought accumulation FULLY SYNCHRONOUSLY via refs
      if (message.type === 'text' || message.type === 'thought') {
        const newContent = message.content as { text: string };
        const msgId = message.msgId;

        // Synchronously append text to accumulator
        const existingText = textAccumulatorRef.current.get(msgId);
        if (existingText !== undefined) {
          textAccumulatorRef.current.set(msgId, existingText + newContent.text);
        } else {
          textAccumulatorRef.current.set(msgId, newContent.text);
          messageMetadataRef.current.set(msgId, message);
        }

        flushToState();
        return;
      }

      // Handle tool_call with deep merge
      if (message.type === 'tool_call') {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.msgId === message.msgId);
          if (idx >= 0) {
            const updated = [...prev];
            const existing = updated[idx];
            const existingContent = existing.content as Record<string, unknown>;
            const newContent = message.content as Record<string, unknown>;
            const mergedContent: Record<string, unknown> = { ...existingContent };
            for (const [k, v] of Object.entries(newContent)) {
              if (v !== undefined && v !== null && v !== '') mergedContent[k] = v;
            }
            updated[idx] = { ...existing, ...message, content: mergedContent };
            return updated;
          }
          return [...prev, message];
        });
        return;
      }

      // Other message types: append directly
      setMessages((prev) => [...prev, message]);
    },
    [flushToState],
  );

  // Track previous jobId to reset state only when switching
  const prevJobIdRef = useRef('');
  useEffect(() => {
    const prev = prevJobIdRef.current;
    prevJobIdRef.current = jobId;
    if (prev && jobId && prev !== jobId) {
      setMessages([]);
      setStatus('idle');
      setCanSend(true);
      setPermissionRequest(null);
      textAccumulatorRef.current = new Map();
      messageMetadataRef.current = new Map();
    }
  }, [jobId]);

  // Subscribe to IPC events
  useEffect(() => {
    const offStream = onIpc('acp-chat:stream', (_event: unknown, data: unknown) => {
      const { jobId: eventJobId, message } = data as { jobId: string; message: Message };
      if (eventJobId !== jobIdRef.current) return;
      processStreamEvent(message);
    });

    const offStatus = onIpc('acp-chat:status', (_event: unknown, data: unknown) => {
      const { jobId: eventJobId, status: newStatus } = data as { jobId: string; status: string };
      if (eventJobId !== jobIdRef.current) return;
      setStatus(newStatus);
      if (newStatus === 'completed' || newStatus === 'failed') {
        setCanSend(true);
      } else if (newStatus === 'running') {
        setCanSend(false);
      }
    });

    const offError = onIpc('acp-chat:error', (_event: unknown, data: unknown) => {
      const { jobId: eventJobId, error } = data as { jobId: string; error: string };
      if (eventJobId !== jobIdRef.current) return;
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        msgId: `error-${Date.now()}`,
        type: 'error',
        role: 'system',
        content: { text: `Error: ${error}` },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setCanSend(true);
    });

    return () => {
      offStream();
      offStatus();
      offError();
    };
  }, [processStreamEvent, jobIdRef]);

  return {
    messages,
    status,
    canSend,
  };
}
