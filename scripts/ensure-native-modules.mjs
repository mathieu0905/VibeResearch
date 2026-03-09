import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const betterSqlite3Dir = path.join(repoRoot, 'node_modules', 'better-sqlite3');
const electronRebuildBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild',
);

if (!existsSync(betterSqlite3Dir)) {
  console.log('[native] better-sqlite3 is not installed; skipping native module check');
  process.exit(0);
}

const probe = spawnSync(electronPath, ['-e', "require('better-sqlite3')"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  encoding: 'utf8',
});

if (probe.status === 0) {
  console.log('[native] better-sqlite3 already matches the Electron runtime');
  process.exit(0);
}

console.warn('[native] better-sqlite3 does not match the Electron runtime; rebuilding...');
if (probe.stderr?.trim()) {
  console.warn(probe.stderr.trim());
}
if (probe.stdout?.trim()) {
  console.warn(probe.stdout.trim());
}

const rebuild = spawnSync(electronRebuildBin, ['-f', '-w', 'better-sqlite3'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (rebuild.error) {
  console.error('[native] Failed to start electron-rebuild:', rebuild.error);
  process.exit(1);
}

process.exit(rebuild.status ?? 1);
