import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getPrismaConfigDatabaseUrl } from "./src/lib/environment";

const databaseUrl = getPrismaConfigDatabaseUrl(
  process.env.DATABASE_URL,
  process.argv.slice(2),
);

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
