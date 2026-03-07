<p align="center">
  <img src="assets/logo.svg" width="160" alt="Vibe Research Logo">
</p>

<h1 align="center">Vibe Research</h1>

<p align="center">
  <strong>AI-Powered Research Desktop App</strong>
</p>

<p align="center">
  Literature management, smart reading notes, and research idea generation — all in one native app
</p>

<p align="center">
  <strong>English</strong> | <a href="README_CN.md">中文</a>
</p>

<p align="center">
  <a href="https://github.com/Noietch/VibeResearch/stargazers"><img src="https://img.shields.io/github/stars/Noietch/VibeResearch?style=for-the-badge&logo=github" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Noietch?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Noietch/VibeResearch/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome"></a>
</p>

---

## What is Vibe Research?

**Vibe Research** is a standalone **Electron desktop app** for researchers. It combines AI-powered paper management, interactive reading, and idea generation in a clean interface — no browser, no server, no plugin required.

## Key Features

| Feature               | Description                                                                 |
| :-------------------- | :-------------------------------------------------------------------------- |
| **Paper Import**      | Batch import from Chrome history, or download single papers by arXiv ID/URL |
| **AI Reading**        | Open PDFs with side-by-side notes; AI fills structured reading cards        |
| **Note Editing**      | Rich-text editor with Vibe (AI) / Manual mode toggle                        |
| **Idea Generation**   | Analyze trends from your paper library, generate research directions        |
| **Multi-Provider AI** | Configure Anthropic, OpenAI, Gemini, or any OpenAI-compatible API           |
| **CLI Tools**         | Run Claude Code, Codex, or Gemini CLI directly inside the app               |

## Quick Links

- **[Installation Guide](docs/install.md)** — Get started in 5 minutes
- **[Usage Guide](docs/usage-en.md)** — Learn how to use each feature

## Requirements

- macOS 12+ / Windows 10+ / Linux
- Node.js >= 18 (for building from source)

## Quick Start

```bash
# Clone and install
git clone https://github.com/Noietch/VibeResearch.git
cd VibeResearch
npm install

# Build and launch
cd apps/electron
npm run build
npx electron .
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ for the research community.
</p>
