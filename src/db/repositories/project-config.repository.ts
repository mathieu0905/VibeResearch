import { getPrismaClient } from '../client';

const PROJECT_CONFIG_SINGLETON_ID = 1;

export interface UpsertProjectConfigParams {
  projectStoragePath: string;
  projectNameZh: string;
  projectNameEn: string;
  settings: Record<string, unknown>;
}

export class ProjectConfigRepository {
  private prisma = getPrismaClient();

  async get() {
    const config = await this.prisma.projectConfig.findUnique({
      where: { id: PROJECT_CONFIG_SINGLETON_ID },
    });

    if (!config) {
      return null;
    }

    return {
      ...config,
      settings: JSON.parse(config.settingsJson) as Record<string, unknown>,
    };
  }

  async upsert(params: UpsertProjectConfigParams) {
    const saved = await this.prisma.projectConfig.upsert({
      where: { id: PROJECT_CONFIG_SINGLETON_ID },
      create: {
        id: PROJECT_CONFIG_SINGLETON_ID,
        projectStoragePath: params.projectStoragePath,
        projectNameZh: params.projectNameZh,
        projectNameEn: params.projectNameEn,
        settingsJson: JSON.stringify(params.settings),
      },
      update: {
        projectStoragePath: params.projectStoragePath,
        projectNameZh: params.projectNameZh,
        projectNameEn: params.projectNameEn,
        settingsJson: JSON.stringify(params.settings),
      },
    });

    return {
      ...saved,
      settings: JSON.parse(saved.settingsJson) as Record<string, unknown>,
    };
  }
}
