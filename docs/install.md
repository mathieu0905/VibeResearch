# Installation Guide / 安装指南

---

## Requirements / 环境要求

| Requirement | Version |
| ----------- | ------- |
| Node.js     | >= 18   |
| npm         | >= 9    |

> SQLite is bundled — no separate install needed.
>
> SQLite 已内置，无需单独安装。

---

## Install from Source / 从源码安装

```bash
# 1. Clone the repo / 克隆仓库
git clone https://github.com/Noietch/VibeResearch.git
cd VibeResearch

# 2. Install all workspace dependencies / 安装所有工作区依赖
npm install

# 3. Build and launch the Electron app / 构建并启动应用
cd apps/electron
npm run build
npx electron .
```

On first launch, the app automatically initializes the local SQLite database in your system's app data directory.

首次启动时，应用会自动在系统应用数据目录中初始化本地 SQLite 数据库。

---

## First Launch / 首次启动

1. **Configure AI Provider** — Go to **Settings → AI Providers**, enter your API key (Anthropic, OpenAI, or Gemini).

   **配置 AI 提供商** — 进入 **设置 → AI 提供商**，填入你的 API Key（Anthropic、OpenAI 或 Gemini）。

2. **Import papers** — Click **Import from Chrome** on the Dashboard, or use the **Download** button to add a single paper by arXiv ID.

   **导入论文** — 在 Dashboard 点击 **从 Chrome 导入**，或使用 **下载** 按钮通过 arXiv ID 添加单篇论文。

3. **Start reading** — Open any paper from the Papers page to launch the PDF reader with AI-powered note generation.

   **开始阅读** — 在论文页面打开任意论文，启动带 AI 笔记生成的 PDF 阅读器。

---

## Development Mode / 开发模式

To run with hot-reload renderer:

启用热重载渲染进程：

```bash
cd apps/electron

# Terminal 1 — watch main process
npm run dev:main

# Terminal 2 — start renderer dev server
npm run dev:renderer

# Terminal 3 — launch Electron (dev mode)
ELECTRON_DEV=1 npx electron .
```

---

## Troubleshooting / 常见问题

### App won't launch / 应用无法启动

```bash
# Rebuild native modules for your Electron version
cd apps/electron
npm run postinstall
npm run build
```

### Tests / 运行测试

```bash
# From repo root
npm test
```

---

## Next Steps / 下一步

- **[Usage Guide (English)](usage-en.md)**
- **[使用指南 (中文)](usage-zh.md)**
