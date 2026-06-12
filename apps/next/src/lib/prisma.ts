import { PrismaClient } from "@prisma/client";

declare global {
  var finstrategyPrisma: PrismaClient | undefined;
}

export function getPrisma() {
  if (!globalThis.finstrategyPrisma) {
    globalThis.finstrategyPrisma = new PrismaClient();
  }

  return globalThis.finstrategyPrisma;
}
