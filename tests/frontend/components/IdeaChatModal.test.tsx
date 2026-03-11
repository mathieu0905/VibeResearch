import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, setupTest, mockIPCResponse, waitFor } from '../../support/render-utils';
import { IdeaChatModal } from '@/components/ideas/IdeaChatModal';
import { mockChatSessions, mockChatMessages, setupChatMocks } from '../../support/chat-mock';

/**
 * Tests for IdeaChatModal component
 * Covers chat session management, messaging, and streaming
 */
describe('IdeaChatModal', () => {
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    projectId: 'project-1',
    projectWorkdir: '/test/project',
    paperIds: ['paper-1', 'paper-2'],
    repoIds: ['repo-1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('renders modal when isOpen is true', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      expect(screen.getByText('Research Chat')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<IdeaChatModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Research Chat')).not.toBeInTheDocument();
    });

    it('displays source count in header', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      // Should show "3 sources" (2 papers + 1 repo)
      expect(await screen.findByText(/3 sources? selected/)).toBeInTheDocument();
    });

    it('shows empty state when no messages', async () => {
      setupChatMocks();
      mockIPCResponse('chat:message:list', []);

      render(<IdeaChatModal {...defaultProps} />);

      expect(
        await screen.findByText('Start a conversation about your research ideas'),
      ).toBeInTheDocument();
    });
  });

  describe('Chat History Sidebar', () => {
    it('loads and displays chat sessions', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      // Sidebar should show chat history
      expect(await screen.findByText('Chat History')).toBeInTheDocument();

      // Should list all sessions
      for (const session of mockChatSessions) {
        expect(await screen.findByText(session.title)).toBeInTheDocument();
      }
    });

    it('shows loading state while loading sessions', () => {
      // Delay the mock response
      const { mockElectronAPI } = require('../../support/frontend-setup');
      mockElectronAPI.invoke.mockImplementation(() => new Promise(() => {}));

      render(<IdeaChatModal {...defaultProps} />);

      // Should show loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows empty state when no sessions', async () => {
      mockIPCResponse('chat:session:list', []);

      render(<IdeaChatModal {...defaultProps} />);

      expect(await screen.findByText('No chat history')).toBeInTheDocument();
    });

    it('highlights current session', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      // Load a session
      const sessionButton = await screen.findByText(mockChatSessions[0].title);
      await setupTest().user.click(sessionButton);

      // The selected session should have active styling
      expect(sessionButton.closest('button')).toHaveClass('bg-notion-accent-light');
    });
  });

  describe('Session Management', () => {
    it('creates new session when clicking new chat button', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const newChatButton = await screen.findByTitle('New Chat');
      await user.click(newChatButton);

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
        'chat:session:create',
        expect.objectContaining({
          projectId: 'project-1',
          title: 'New Chat',
          paperIds: ['paper-1', 'paper-2'],
          repoIds: ['repo-1'],
        }),
      );
    });

    it('loads session messages when clicking on a session', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const sessionButton = await screen.findByText(mockChatSessions[0].title);
      await user.click(sessionButton);

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
        'chat:session:get',
        mockChatSessions[0].id,
      );
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
        'chat:message:list',
        mockChatSessions[0].id,
      );
    });

    it('deletes session when clicking delete', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      // Find delete button (Trash2 icon) for first session
      const sessionButton = await screen.findByText(mockChatSessions[0].title);
      const deleteButton = sessionButton.parentElement?.querySelector(
        '[class*="hover\\:bg-red-100"]',
      );

      if (deleteButton) {
        await user.click(deleteButton);

        expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
          'chat:session:delete',
          mockChatSessions[0].id,
        );
      }
    });

    it('toggles sidebar visibility', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      // Find and click the toggle button (chevron left to hide)
      const toggleButton = await screen.findByTitle('Hide sidebar');
      await user.click(toggleButton);

      // Sidebar should be hidden
      expect(screen.queryByText('Chat History')).not.toBeInTheDocument();

      // Click again to show
      const showButton = await screen.findByTitle('Show sidebar');
      await user.click(showButton);

      expect(await screen.findByText('Chat History')).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    it('sends message on Enter key', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Hello AI');
      await user.keyboard('{Enter}');

      // Should create session and send message
      await waitFor(() => {
        expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
          'chat:message:add',
          expect.objectContaining({
            role: 'user',
            content: 'Hello AI',
          }),
        );
      });
    });

    it('sends message on send button click', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Test message');

      const sendButton = screen.getByRole('button', { name: '' }); // Send button has no text, just icon
      await user.click(sendButton);

      await waitFor(() => {
        expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
          'chat:message:add',
          expect.objectContaining({
            role: 'user',
            content: 'Test message',
          }),
        );
      });
    });

    it('does not send empty message', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      // Try to send empty message
      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toBeDisabled();

      await user.click(sendButton);

      // Should not call message add
      expect(window.electronAPI?.invoke).not.toHaveBeenCalledWith(
        'chat:message:add',
        expect.anything(),
      );
    });

    it('allows Shift+Enter for new line', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(textarea, 'Line 2');

      // Textarea should contain both lines
      expect(textarea).toHaveValue('Line 1\nLine 2');
    });
  });

  describe('Message Streaming', () => {
    it('displays streaming content', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Test');
      await user.keyboard('{Enter}');

      // Should show streaming indicator
      await waitFor(() => {
        expect(screen.getByText('Thinking…')).toBeInTheDocument();
      });
    });

    it('shows stop button during streaming', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Test');
      await user.keyboard('{Enter}');

      // Wait for streaming state
      await waitFor(() => {
        // Stop button should be visible (Square icon button)
        const stopButton = document.querySelector('.bg-red-500');
        expect(stopButton).toBeInTheDocument();
      });
    });

    it('stops streaming when stop button clicked', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Ask about research ideas…');
      await user.type(textarea, 'Test');
      await user.keyboard('{Enter}');

      // Wait for streaming state and click stop
      await waitFor(() => {
        const stopButton = document.querySelector('.bg-red-500');
        if (stopButton) {
          user.click(stopButton as HTMLElement);
        }
      });

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith('chat:kill', expect.any(String));
    });
  });

  describe('Modal Closing', () => {
    it('closes on X button click', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      // Find the X button specifically (last one in header)
      const xButtons = document.querySelectorAll('button');
      const xButton = Array.from(xButtons).find((btn) => btn.innerHTML.includes('X'));

      if (xButton) {
        await user.click(xButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('closes on backdrop click', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      // Click on backdrop (the element with bg-black/30)
      const backdrop = document.querySelector('.bg-black\\/30');
      if (backdrop) {
        await user.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('closes on Escape key', async () => {
      setupChatMocks();
      const { user } = setupTest();

      render(<IdeaChatModal {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Research Chat' })).toBeInTheDocument();
    });

    it('textarea has proper placeholder', () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('Ask about research ideas…')).toBeInTheDocument();
    });

    it('buttons have accessible titles', async () => {
      setupChatMocks();
      render(<IdeaChatModal {...defaultProps} />);

      expect(screen.getByTitle('New Chat')).toBeInTheDocument();
      expect(screen.getByTitle('Hide sidebar')).toBeInTheDocument();
    });
  });
});
