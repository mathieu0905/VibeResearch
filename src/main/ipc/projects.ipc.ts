import { ipcMain } from 'electron';
import { ProjectsService } from '../services/projects.service';

const svc = new ProjectsService();

export function setupProjectsIpc() {
  // Projects
  ipcMain.handle('projects:list', () => svc.listProjects());
  ipcMain.handle('projects:create', (_, input) => svc.createProject(input));
  ipcMain.handle('projects:update', (_, id: string, data) => svc.updateProject(id, data));
  ipcMain.handle('projects:delete', (_, id: string) => svc.deleteProject(id));
  ipcMain.handle('projects:touch', (_, id: string) => svc.touchProject(id));

  // Todos
  ipcMain.handle('projects:todo:create', (_, input) => svc.createTodo(input));
  ipcMain.handle('projects:todo:update', (_, id: string, data) => svc.updateTodo(id, data));
  ipcMain.handle('projects:todo:delete', (_, id: string) => svc.deleteTodo(id));

  // Repos
  ipcMain.handle('projects:repo:add', (_, input) => svc.addRepo(input));
  ipcMain.handle('projects:repo:clone', (_, repoId: string, repoUrl: string) =>
    svc.cloneRepo(repoId, repoUrl),
  );
  ipcMain.handle('projects:repo:commits', (_, localPath: string, limit?: number) =>
    svc.getCommits(localPath, limit),
  );
  ipcMain.handle('projects:repo:delete', (_, id: string) => svc.deleteRepo(id));

  // Ideas
  ipcMain.handle('projects:idea:create', (_, input) => svc.createIdea(input));
  ipcMain.handle('projects:idea:delete', (_, id: string) => svc.deleteIdea(id));
}
