import { ipcMain, BrowserWindow } from 'electron';
import {
  buildNonInteractiveCliArgs,
  detectAllCliTools,
  runCliToWindow,
  getShellPath,
  type CliUsageSummary,
} from '../services/cli-runner.service';
import { spawnSync } from 'child_process';
import { getCliTools, saveCliTools, type CliConfig } from '../store/cli-tools-store';
import { recordTokenUsage } from '../store/token-usage-store';
import { CliRunOptionsSchema, EnvVarsStringSchema, parseEnvVars, validate } from './validate';
import { type IpcResult, ok, err } from '@shared';

const activeProcesses = new Map<string, { kill: () => void }>();
const sessionUsage = new Map<
  string,
  { provider: string; model: string; usage?: CliUsageSummary }
>();

function finalizeSessionUsage(sessionId: string) {
  const usageState = sessionUsage.get(sessionId);
  if (usageState?.usage) {
    recordTokenUsage({
      timestamp: new Date().toISOString(),
      provider: usageState.provider,
      model: usageState.usage.model ?? usageState.model,
      promptTokens: usageState.usage.promptTokens,
      completionTokens: usageState.usage.completionTokens,
      totalTokens: usageState.usage.totalTokens,
      kind: 'agent',
    });
  }
  sessionUsage.delete(sessionId);
  activeProcesses.delete(sessionId);
}

export function setupCliToolsIpc() {
  // ─── CLI Tool Config Persistence ───────────────────────────────────────────

  ipcMain.handle('cliTools:list', async (): Promise<IpcResult<unknown>> => {
    try {
      return ok(getCliTools());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[cliTools:list] Error:', msg);
      return err(msg);
    }
  });

  ipcMain.handle(
    'cliTools:save',
    async (_, tools: CliConfig[]): Promise<IpcResult<{ success: boolean }>> => {
      try {
        saveCliTools(tools);
        return ok({ success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[cliTools:save] Error:', msg);
        return err(msg);
      }
    },
  );
  });

  // ─── CLI Detection & Execution ─────────────────────────────────────────────

  ipcMain.handle('cli:detect', async (): Promise<IpcResult<unknown>> => {
    try {
      return ok(await detectAllCliTools());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[cli:detect] Error:', msg);
      return err(msg);
    }
  });

  /** Test a CLI tool by running a minimal non-interactive prompt and checking output */
  ipcMain.handle(
    'cli:test',
    async (
      _,
      command: string,
      extraArgs?: string,
      envVars?: string,
    ): Promise<IpcResult<{ success: boolean; output?: string; error?: string }>> => {
      try {
        if (!command || typeof command !== 'string') {
          return ok({ success: false, error: 'Command is required' });
        }

        if (envVars) {
          const envResult = validate(EnvVarsStringSchema, envVars);
          if (!envResult.success) {
            return ok({ success: false, error: `Invalid environment variables: ${envResult.error}` });
          }
        }

        const env: Record<string, string | undefined> = { ...process.env, PATH: getShellPath() };
        delete env.CLAUDECODE;
        if (envVars) {
          Object.assign(env, parseEnvVars(envVars));
        }

        const cmdParts = command.trim().split(/\s+/);
        const binary = cmdParts[0];
        const extraArgsList = extraArgs ? extraArgs.trim().split(/\s+/) : [];
        const args = [
          ...cmdParts.slice(1),
          ...extraArgsList,
          ...buildNonInteractiveCliArgs(binary, 'Reply with just the word: pong'),
        ];

        const result = spawnSync(binary, args, {
          env,
          timeout: 20000,
          encoding: 'utf-8',
        });

        if (result.error) {
          return ok({ success: false, error: result.error.message.slice(0, 300) });
        }

        if (result.status !== 0 && result.stderr) {
          return ok({ success: false, error: result.stderr.slice(0, 300) });
        }

        return ok({ success: true, output: result.stdout.trim().slice(0, 300) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return ok({ success: false, error: msg.slice(0, 300) });
      }
    },
  );

  ipcMain.handle(
    'cli:run',
    async (
      event,
      options: {
        tool: string;
        args: string[];
        sessionId: string;
        cwd?: string;
        envVars?: string; // space-separated KEY=value pairs
        useProxy?: boolean;
        homeFiles?: Array<{ relativePath: string; content: string }>;
      },
    ): Promise<IpcResult<{ sessionId: string; started: boolean }>> => {
      try {
        const validation = validate(CliRunOptionsSchema, options);
        if (!validation.success) {
          return err(`Invalid options: ${validation.error}`);
        }

        const opts = validation.data;
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return err('No window found');

        const existing = activeProcesses.get(opts.sessionId);
        if (existing) existing.kill();

        const parsedEnv = parseEnvVars(opts.envVars || '');
        const cmdParts = opts.tool.trim().split(/\s+/);
        const command = cmdParts[0];
        const commandArgs = [...cmdParts.slice(1), ...(opts.args ?? [])];

        sessionUsage.set(opts.sessionId, { provider: command, model: opts.tool });

        const proc = runCliToWindow(win, command, commandArgs, opts.sessionId, {
          cwd: opts.cwd,
          env: parsedEnv,
          useProxy: opts.useProxy,
          homeFiles: 'homeFiles' in (options as Record<string, unknown>)
            ? ((options as { homeFiles?: Array<{ relativePath: string; content: string }> }).homeFiles)
            : undefined,
          onUsage: (usage) => {
            const existingUsage = sessionUsage.get(opts.sessionId);
            if (!existingUsage) return;
            sessionUsage.set(opts.sessionId, {
              ...existingUsage,
              usage,
              model: usage.model ?? existingUsage.model,
            });
          },
          onDone: () => {
            finalizeSessionUsage(opts.sessionId);
          },
        });

        const wrappedProc = {
          kill: () => {
            proc.kill();
            finalizeSessionUsage(opts.sessionId);
          },
        };

        activeProcesses.set(opts.sessionId, wrappedProc);
        return ok({ sessionId: opts.sessionId, started: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[cli:run] Error:', msg);
        return err(msg);
      }
    },
  );

  ipcMain.handle(
    'cli:kill',
    async (_, sessionId: string): Promise<IpcResult<{ killed: boolean }>> => {
      try {
        const proc = activeProcesses.get(sessionId);
        if (proc) {
          proc.kill();
          return ok({ killed: true });
        }
        return ok({ killed: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[cli:kill] Error:', msg);
        return err(msg);
      }
    },
  );
}
