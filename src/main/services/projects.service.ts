import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import { ProjectsRepository } from '@db';
import { getShellPath } from './cli-runner.service';

export interface CloneResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

function execAsync(
  cmd: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      { ...options, env: options.env ?? { ...process.env, PATH: getShellPath() } },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      },
    );
  });
}

export class ProjectsService {
  private repo = new ProjectsRepository();

  // ── Projects ──────────────────────────────────────────────────────────────

  async listProjects() {
    const projects = await this.repo.listProjects();
    return projects.map((p) => ({
      ...p,
      ideas: p.ideas.map((idea) => ({
        ...idea,
        paperIds: JSON.parse(idea.paperIdsJson) as string[],
      })),
    }));
  }

  async createProject(input: { name: string; description?: string }) {
    return this.repo.createProject(input);
  }

  async updateProject(id: string, data: { name?: string; description?: string }) {
    return this.repo.updateProject(id, data);
  }

  async deleteProject(id: string) {
    return this.repo.deleteProject(id);
  }

  async touchProject(id: string) {
    return this.repo.touchLastAccessed(id);
  }

  // ── Todos ─────────────────────────────────────────────────────────────────

  async createTodo(input: { projectId: string; text: string }) {
    return this.repo.createTodo(input);
  }

  async updateTodo(id: string, data: { text?: string; done?: boolean }) {
    return this.repo.updateTodo(id, data);
  }

  async deleteTodo(id: string) {
    return this.repo.deleteTodo(id);
  }

  // ── Repos ─────────────────────────────────────────────────────────────────

  async addRepo(input: { projectId: string; repoUrl: string }) {
    return this.repo.createRepo({ projectId: input.projectId, repoUrl: input.repoUrl });
  }

  async cloneRepo(repoId: string, repoUrl: string): Promise<CloneResult> {
    // Clone into ~/vibe-research-repos/<owner>/<repo>
    const urlParts = repoUrl.replace(/\.git$/, '').split('/');
    const repoName = urlParts.slice(-2).join('/');
    const localPath = path.join(os.homedir(), 'vibe-research-repos', repoName);

    try {
      await execAsync(`mkdir -p "${path.dirname(localPath)}"`);
      await execAsync(`git clone --depth=50 "${repoUrl}" "${localPath}"`);
      await this.repo.updateRepo(repoId, { localPath, clonedAt: new Date() });
      return { success: true, localPath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async getCommits(localPath: string, limit = 30): Promise<CommitInfo[]> {
    try {
      const format = '%H|%h|%s|%an|%ai';
      const output = await execAsync(`git log --pretty=format:"${format}" -n ${limit}`, {
        cwd: localPath,
      });
      if (!output) return [];
      return output.split('\n').map((line) => {
        const [hash, shortHash, message, author, date] = line.split('|');
        return { hash, shortHash, message, author, date };
      });
    } catch {
      return [];
    }
  }

  async deleteRepo(id: string) {
    return this.repo.deleteRepo(id);
  }

  // ── Ideas ─────────────────────────────────────────────────────────────────

  async createIdea(input: {
    projectId: string;
    title: string;
    content: string;
    paperIds?: string[];
  }) {
    return this.repo.createIdea(input);
  }

  async deleteIdea(id: string) {
    return this.repo.deleteIdea(id);
  }
}
