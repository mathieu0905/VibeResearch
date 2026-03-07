// @prisma/client is a CommonJS module; use default import for ESM compatibility
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
type PrismaClient = InstanceType<typeof PrismaClient>;

let prisma: PrismaClient | undefined;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};
