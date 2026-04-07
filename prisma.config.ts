import dotenv from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });
dotenv.config();

const rawDatabaseUrl = process.env.DATABASE_URL ?? "file:./prisma/study.db";

if (rawDatabaseUrl.startsWith("file:./prisma/")) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), rawDatabaseUrl.replace("file:./", ""))}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
