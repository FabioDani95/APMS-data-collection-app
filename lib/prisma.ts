import path from "node:path";

import { PrismaClient } from "@prisma/client";

const rawDatabaseUrl = process.env.DATABASE_URL ?? "file:./prisma/study.db";

if (rawDatabaseUrl.startsWith("file:./prisma/")) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), rawDatabaseUrl.replace("file:./", ""))}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
