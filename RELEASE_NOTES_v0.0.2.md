# ResearchClaw v0.0.2 Release Notes

## Overview

ResearchClaw is a standalone Electron desktop app for researchers to manage papers, track reading progress, and organize research ideas.

## What's New in v0.0.2

### Major Features

#### 1. Chat & Task System Separation

- **Chat History**: Chat conversations are now persisted independently with full history support
  - New database tables: `ChatSession` and `ChatMessage`
  - Chat sidebar for browsing and managing historical conversations
  - Auto-title generation for chat sessions based on first message
- **Task System**: Agent tasks are now completely separate from chat
  - Tasks are created manually from the Tasks tab only
  - Removed automatic task extraction from chat messages
  - Cleaner, more focused UX for both features

#### 2. Enhanced npx Resolution

- Fixed "spawn npx ENOENT" error when running agent tasks
- New `resolveNpxPath()` function finds npx from the active Node.js binary
- Better cross-platform support for different Node.js installations (Homebrew, nvm, volta, etc.)

#### 3. Frontend Testing Infrastructure

- Added Vitest configuration for frontend component testing
- New test utilities: `tests/support/frontend-setup.ts`, `render-utils.tsx`, `chat-mock.ts`
- Component tests for:
  - `TodoCard` - Task card rendering and interactions
  - `TodoForm` - Task creation form validation
  - `IdeaChatModal` - Chat modal functionality
  - `PriorityBar` - Priority indicator component
  - `StatusDot` - Status indicator component

### Technical Improvements

#### Database Schema

- Added `ChatSession` model for chat history
- Added `ChatMessage` model for individual messages
- Foreign key relationships between sessions and messages

#### IPC Channels (New)

- `chat:session:list`, `chat:session:create`, `chat:session:delete`
- `chat:message:list`, `chat:message:create`
- `chat:stream`, `chat:kill`, `chat:generateTitle`

#### UI/UX Enhancements

- Updated `IdeaChatModal` with sidebar navigation for chat history
- Improved `MessageStream` component for better message rendering
- Refactored `PermissionCard` and `PlanCard` components
- New `ToolCallGroup` component for grouped tool calls

### Bug Fixes

- Fixed shell environment PATH resolution on macOS
- Improved command resolution for CLI tools (npx, node)

### Build & CI

- Updated build script to use official GitHub releases for electron-builder binaries
- macOS release now builds arm64-only (removed x64 support temporarily)

## Downloads

### macOS (Apple Silicon)

- **DMG**: `ResearchClaw-0.0.2-arm64.dmg` (~145 MB)
- **ZIP**: `ResearchClaw-0.0.2-arm64-mac.zip` (~530 MB)

### Linux

- **AppImage**: Available via CI build

## Installation

### macOS

1. Download the DMG file
2. Open the DMG and drag ResearchClaw to Applications
3. On first launch, right-click and select "Open" to bypass Gatekeeper

### Linux

1. Download the AppImage
2. Make it executable: `chmod +x ResearchClaw-0.0.2.AppImage`
3. Run: `./ResearchClaw-0.0.2.AppImage`

## Known Issues

- macOS Intel (x64) builds temporarily unavailable due to electron-builder binary download issues
- Windows builds not yet available (coming in future release)

## Feedback & Support

- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/researchclaw/issues)
- Email: support@researchclaw.app

---

**Full Changelog**: Compare with v0.0.1
