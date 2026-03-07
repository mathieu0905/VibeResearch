# Changelog

## 2026-03-07

### PDF Text Storage: Local Files Instead of Database

- **Scope**: `prisma/schema.prisma`, `src/main/services/paper-text.service.ts`, `src/db/repositories/papers.repository.ts`, `src/main/services/reading.service.ts`
- **Changes**:
  - Removed `textContent` and `textExtractedAt` fields from Paper model
  - Added `textPath` field to store path to local text file
  - PDF extracted text now saved to `papers/{shortId}/text.txt` instead of database
  - `getPaperExcerptCached()` now requires `shortId` parameter for file path resolution
  - Replaced `updateTextContent()` and `getTextContent()` with single `updateTextPath()` method
- **Rationale**: Storing large text content in SQLite bloats the database; local files are more efficient
- **Test Design**: Manual testing in Electron app
- **Validation**: Build passes, all 21 tests pass

## 2026-03-07

### Settings: UX Improvements & API Connection Test

- **Scope**: `src/renderer/pages/settings/page.tsx`, `src/renderer/components/model-combobox.tsx`, `src/main/store/model-config-store.ts`, `src/main/services/ai-provider.service.ts`, `src/main/ipc/models.ipc.ts`, `src/renderer/hooks/use-ipc.ts`
- **Changes**:
  - Removed "搜索模型或直接输入自定义ID" hint from model dropdown
  - Changed default API provider from Anthropic to OpenAI
  - Auto-activate first model when no active model exists for that kind
  - Added "Test Connection" button for API models (both in Add modal and saved cards) with real-time feedback
  - Test sends minimal request to verify API key and endpoint validity
  - Shows success/failure message after test
- **Test Design**: Manual UI testing in Electron app
- **Validation**: Build passes, type check passes, all tests pass

### Chat: New Chat & Clear Chat Buttons

- **Scope**: `src/renderer/pages/papers/reader/page.tsx`
- **Changes**:
  - Added "Clear Chat" button in chat dropdown menu (red text with trash icon)
  - Only shows when there's an active chat with messages
  - Clears messages and saves empty state to database
  - "New Chat" button creates a fresh chat session
- **Test Design**: Manual UI testing
- **Validation**: Build passes, all tests pass

### Fix: Batch Delete Papers Cascade

- **Scope**: `src/db/repositories/papers.repository.ts`, `src/main/services/papers.service.ts`, `src/renderer/components/papers-by-tag.tsx`
- **Changes**:
  - Fixed batch delete failure by wrapping deletes in a Prisma transaction
  - Prisma's `deleteMany` doesn't trigger application-level cascade deletes defined in schema
  - Now deletes ReadingNote, PaperTag, SourceEvent, and PaperCodeLink before Paper atomically
  - Added empty array guard clause
  - Added error logging in service layer
  - Improved frontend error message display to show actual error
- **Test Design**: Manual UI testing (batch delete in Electron app)
- **Validation**: Build passes, all tests pass

### Agentic Search: Error Feedback

- **Scope**: `src/renderer/components/search-content.tsx`
- **Changes**:
  - Added error state display when Agentic Search fails (e.g., no AI provider configured)
  - Shows red error card with message and link to Settings page
  - Removed silent fallback to normal search - user now sees why it failed
- **Test Design**: Manual UI testing
- **Validation**: TypeScript compiles

### Chat: AI Status Indicator & Notes Cleanup

- **Scope**: `src/renderer/pages/papers/reader/page.tsx`, `src/renderer/pages/papers/notes/page.tsx`
- **Changes**:
  - **Chat page**: Added AI status indicator showing current AI activity with gray spinner:
    - "正在提取PDF文本..." when extracting PDF text
    - "正在思考..." when waiting for AI response
  - Chat now extracts PDF text before sending to CLI for better context
  - **Notes page**: Removed "AI Fill" and "Summarize" buttons to simplify the interface
- **Test Design**: Manual UI testing
- **Validation**: Build passes

### Security: Remove Hardcoded API Keys from Tests

- **Scope**: `tests/integration/ai-provider.test.ts`, `tests/integration/reading.test.ts`, `.gitignore`
- **Changes**:
  - Removed all hardcoded API keys from test files
  - Tests now use environment variables only (`TEST_API_KEY`, `TEST_BASE_URL`, `TEST_LIGHTWEIGHT_MODEL`, `TEST_CHAT_MODEL`)
  - Added `.secrets`, `*.secret`, `.test-env` to `.gitignore` to prevent accidental commits
  - AI-related tests are automatically skipped if no API key is configured
- **Test Design**:
  - `ai-provider.test.ts`: Uses `maybeIt` to skip tests without API key
  - `reading.test.ts`: Added `aiEditNotes` test for AI chat functionality, skipped without API key
- **Validation**: All 21 tests pass (8 skipped - require API key)

### Test: AI Chat Dialogue (aiEditNotes)

- **Scope**: `tests/integration/reading.test.ts`
- **Changes**:
  - Added test for `ReadingService.aiEditNotes()` method
  - Test creates a paper with title/abstract and calls AI to generate reading notes
  - Verifies AI returns non-empty content for "Research Problem" and "Core Method" sections
- **Validation**: Test passes with API key configured (skipped otherwise)

### Library: Filter UI Improvements with Tag Modal

- **Scope**: `src/renderer/components/papers-by-tag.tsx`, `tailwind.config.ts`
- **Changes**:
  - Unified filter button styles: all use `rounded-lg px-2.5 py-1.5 text-sm font-medium`
  - Added section labels: "TIME", "YEAR", "TAG" in uppercase for better UX
  - Limited visible tags to 8, added "More" button for overflow
  - Added tag selection modal with fade-in and scale-in animations
  - Added `fade-in` and `scale-in` keyframes/animation to tailwind config
- **Test Design**: Manual UI verification
- **Validation**: Build passes

### PDF Text Extraction: pdf-parse v2 + Text Caching

- **Scope**: `src/main/services/pdf-extractor.service.ts`, `src/main/services/paper-text.service.ts`, `src/main/services/reading.service.ts`, `prisma/schema.prisma`, `src/db/repositories/papers.repository.ts`, `tests/integration/pdf-extractor.test.ts`, `tests/integration/ai-provider.test.ts`
- **Changes**:
  - Upgraded to `pdf-parse` v2 which uses a class-based API (`new PDFParse({ data: buffer }).getText()`)
  - Fixed pdf-parse dynamic import for ESM compatibility
  - Added HTTP request timeout (60s) for PDF downloads to prevent hanging
  - Added `textContent` and `textExtractedAt` fields to Paper model for caching extracted text
  - Created `paper-text.service.ts` to wrap PDF extraction with caching logic
  - Updated `reading.service.ts` to use cached paper text via `getPaperExcerptCached()`
  - Added `updateTextContent()` and `getTextContent()` methods to PapersRepository
  - Updated live PDF tests to be skipped by default (network-dependent), run with `RUN_LIVE_TESTS=1 npm test`
- **Test Design**:
  - `pdf-extractor.test.ts`: Unit tests for arxiv ID extraction, live tests skipped by default
  - `ai-provider.test.ts`: Tests for custom OpenAI-compatible API endpoint with model kind selection
- **Validation**: All 24 tests pass (4 skipped)

---

### Library: Batch Delete Papers

- **Scope**: `src/db/repositories/papers.repository.ts`, `src/main/services/papers.service.ts`, `src/main/ipc/papers.ipc.ts`, `src/renderer/hooks/use-ipc.ts`, `src/renderer/components/papers-by-tag.tsx`
- **Changes**:
  - Added `deleteMany(ids: string[])` method to PapersRepository using Prisma's `deleteMany`
  - Added batch delete service method in PapersService
  - Added `papers:deleteMany` IPC handler
  - Added `deletePapers()` IPC client method in use-ipc.ts
  - Added selection mode UI to PapersByTag component:
    - "Select" button to enter selection mode
    - Checkboxes on each paper card when in selection mode
    - Selection toolbar showing count, select all/deselect all, cancel, and delete buttons
    - Delete confirmation modal with framer-motion animations
    - ESC key support to close modal
  - Used AnimatePresence for smooth toolbar and modal transitions
- **Test Design**: Manual UI testing (batch delete through Electron app)
- **Validation**: Build passes, TypeScript compiles

## 2026-03-07

### Settings: UX Improvements & API Connection Test

- **Scope**: `src/renderer/pages/settings/page.tsx`, `src/renderer/components/model-combobox.tsx`, `src/main/store/model-config-store.ts`, `src/main/services/ai-provider.service.ts`, `src/main/ipc/models.ipc.ts`, `src/renderer/hooks/use-ipc.ts`
- **Changes**:
  - Removed "搜索模型或直接输入自定义ID" hint from model dropdown
  - Changed default API provider from Anthropic to OpenAI
  - Auto-activate first model when no active model exists for that kind
  - Added "Test Connection" button for API models (both in Add modal and saved cards) with real-time feedback
  - Test sends minimal request to verify API key and endpoint validity
  - Shows success/failure message after test
- **Test Design**: Manual UI testing in Electron app
- **Validation**: Build passes, type check passes, all tests pass

### Settings: Allow custom baseURL for all API providers

- Changed baseURL input visibility from `custom` provider only to all API providers
- Users can now set custom API endpoints for Anthropic, OpenAI, Gemini (e.g., for proxies)
- Placeholder text updated to indicate optional override
