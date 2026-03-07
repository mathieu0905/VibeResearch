#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const slugArg = process.argv.slice(2).join('-').trim();
const slug = slugArg
  ? slugArg
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
  : 'implementation-summary';

const now = new Date();
const date = now.toISOString().slice(0, 10);
const fileName = `${date}-${slug}.md`;
const changelogDir = path.resolve(process.cwd(), 'changelog');
const filePath = path.join(changelogDir, fileName);

if (!fs.existsSync(changelogDir)) {
  fs.mkdirSync(changelogDir, { recursive: true });
}

if (fs.existsSync(filePath)) {
  console.error(`Changelog entry already exists: ${filePath}`);
  process.exit(1);
}

const template = `# ${date} ${slug.replace(/-/g, ' ')}\n\n## 功能变更摘要\n- \n\n## 实现方案与关键决策\n- \n\n## 影响文件\n- \n\n## 本次对应功能测试设计\n- 新增/更新测试文件：\n- 用例编号与场景：\n- 覆盖边界：\n\n## 验证结果\n- npm run lint:\n- npm run format:check:\n- npm test:\n- npm run test:e2e:\n`;

fs.writeFileSync(filePath, template, 'utf8');
console.log(filePath);
