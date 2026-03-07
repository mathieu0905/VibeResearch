<p align="center">
  <img src="assets/logo.svg" width="160" alt="Vibe Research Logo">
</p>

<h1 align="center">Vibe Research</h1>

<p align="center">
  <strong>AI 驱动的科研桌面应用</strong>
</p>

<p align="center">
  文献管理、智能阅读笔记、研究创意生成 — 全部集成在一个原生应用中
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

<p align="center">
  <a href="https://github.com/Noietch/VibeResearch/stargazers"><img src="https://img.shields.io/github/stars/Noietch/VibeResearch?style=for-the-badge&logo=github" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Noietch/VibeResearch?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Noietch/VibeResearch/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome"></a>
</p>

---

## 什么是 Vibe Research？

**Vibe Research** 是一个独立的 **Electron 桌面应用**，专为科研工作者设计。它将 AI 驱动的论文管理、交互式阅读和创意生成整合在一个简洁的风格界面中 — 无需浏览器、无需服务器、无需插件。

## 核心功能

| 功能             | 描述                                                     |
| :--------------- | :------------------------------------------------------- |
| **论文导入**     | 从 Chrome 历史批量导入，或通过 arXiv ID/URL 下载单篇论文 |
| **AI 阅读**      | 打开 PDF 并排显示笔记，AI 自动填充结构化阅读卡片         |
| **笔记编辑**     | 富文本编辑器，支持 Vibe（AI）/ 手动模式切换              |
| **创意生成**     | 分析论文库趋势，生成研究方向建议                         |
| **多 AI 提供商** | 配置 Anthropic、OpenAI、Gemini 或任意 OpenAI 兼容 API    |
| **CLI 工具**     | 直接在应用内运行 Claude Code、Codex 或 Gemini CLI        |

## 快速链接

- **[安装指南](docs/install.md)** — 5 分钟快速上手
- **[使用指南](docs/usage-zh.md)** — 了解每个功能的用法

## 环境要求

- macOS 12+ / Windows 10+ / Linux
- Node.js >= 18（从源码构建时需要）

## 快速开始

```bash
# 克隆并安装
git clone https://github.com/Noietch/VibeResearch.git
cd VibeResearch
npm install

# 构建并启动
cd apps/electron
npm run build
npx electron .
```

## 许可证

MIT 许可证 — 详见 [LICENSE](LICENSE)。

---

<p align="center">
  Built with ❤️ for the research community.
</p>
