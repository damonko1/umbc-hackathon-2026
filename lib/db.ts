import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function isHistoryPersistenceEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function createClient() {
  const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}

let cachedClient: PrismaClient | null = null;

export function getDb() {
  if (!isHistoryPersistenceEnabled()) {
    throw new Error("History persistence is not configured. Set DATABASE_URL first.");
  }

  if (!cachedClient) {
    cachedClient = createClient();
  }

  return cachedClient;
}
