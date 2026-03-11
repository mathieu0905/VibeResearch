/**
 * Shell environment utilities for the main process.
 *
 * Loads environment variables from the user's login shell so that child
 * processes spawned by Electron (e.g. npx, codex, goose ...) inherit the
 * correct PATH, even when the app is launched from Finder / launchd
 * instead of a terminal.
 *
 * Based on AionUi's shellEnv.ts pattern.
 */

import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';

/**
 * Environment variables to inherit from user's shell.
 * These may not be available when Electron app starts from Finder/launchd.
 */
const SHELL_INHERITED_ENV_VARS = [
  'PATH',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
] as const;

/** Cache for shell environment (loaded once per session) */
let cachedShellEnv: Record<string, string> | null = null;

/**
 * Load environment variables from user's login shell.
 * Captures variables set in .bashrc, .zshrc, .bash_profile, etc.
 */
function loadShellEnvironment(): Record<string, string> {
  if (cachedShellEnv !== null) {
    return cachedShellEnv;
  }

  cachedShellEnv = {};

  // Skip on Windows - shell config loading not needed
  if (process.platform === 'win32') {
    return cachedShellEnv;
  }

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    if (!path.isAbsolute(shell)) {
      console.warn('[ShellEnv] SHELL is not an absolute path, skipping shell env loading:', shell);
      return cachedShellEnv;
    }

    // Use -i (interactive) and -l (login) to load all shell configs
    // including .bashrc, .zshrc, .bash_profile, .zprofile, etc.
    const output = execFileSync(shell, ['-i', '-l', '-c', 'env'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: os.homedir() },
    });

    // Parse and capture only the variables we need
    for (const line of output.split('\n')) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        const value = line.substring(eqIndex + 1);
        if (SHELL_INHERITED_ENV_VARS.includes(key as (typeof SHELL_INHERITED_ENV_VARS)[number])) {
          cachedShellEnv[key] = value;
        }
      }
    }

    if (cachedShellEnv.PATH) {
      console.log(
        '[ShellEnv] Loaded PATH from shell:',
        cachedShellEnv.PATH.substring(0, 100) + '...',
      );
    }
  } catch (error) {
    console.warn(
      '[ShellEnv] Failed to load shell environment:',
      error instanceof Error ? error.message : String(error),
    );
  }

  return cachedShellEnv;
}

/**
 * Merge two PATH strings, removing duplicates while preserving order.
 */
export function mergePaths(path1?: string, path2?: string): string {
  const separator = process.platform === 'win32' ? ';' : ':';
  const paths1 = path1?.split(separator).filter(Boolean) || [];
  const paths2 = path2?.split(separator).filter(Boolean) || [];

  const seen = new Set<string>();
  const merged: string[] = [];

  // Add paths from first source (process.env, typically from terminal)
  for (const p of paths1) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }

  // Add paths from second source (shell env, for Finder/launchd launches)
  for (const p of paths2) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }

  return merged.join(separator);
}

/**
 * Get enhanced environment variables by merging shell env with process.env.
 * For PATH, we merge both sources to ensure CLI tools are found regardless of
 * how the app was started (terminal vs Finder/launchd).
 *
 * This is the key function to use when spawning child processes that need
 * access to tools like npx, node, npm, etc.
 */
export function getEnhancedEnv(customEnv?: Record<string, string>): Record<string, string> {
  const shellEnv = loadShellEnvironment();

  // Merge PATH from both sources (shell env may miss nvm/fnm paths in dev mode)
  const mergedPath = mergePaths(process.env.PATH, shellEnv.PATH);

  return {
    ...process.env,
    ...shellEnv,
    ...customEnv,
    // PATH must be set after spreading to ensure merged value is used
    PATH: customEnv?.PATH ? mergePaths(mergedPath, customEnv.PATH) : mergedPath,
  } as Record<string, string>;
}

/**
 * Clear the shell environment cache.
 * Useful for testing or when shell configuration changes.
 */
export function clearShellEnvCache(): void {
  cachedShellEnv = null;
}
