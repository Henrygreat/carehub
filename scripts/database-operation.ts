import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { requireDatabaseUrl } from "../src/lib/environment";

const operation = process.argv[2];
const databaseUrl = requireDatabaseUrl(process.env.DATABASE_URL);

if (operation === "status") {
  // Read-only: reports applied and pending migrations; changes nothing.
  runPrisma(["migrate", "status"]);
} else if (operation === "migrate") {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CONFIRM_DB_BACKUP !== "yes"
  ) {
    throw new Error(
      "Refusing to apply migrations to a production database without a backup. Take a backup, then rerun with CONFIRM_DB_BACKUP=yes.",
    );
  }
  runPrisma(["migrate", "deploy"]);
} else if (operation === "seed") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed is disabled when NODE_ENV=production.");
  }
  runCommand("tsx/dist/cli.mjs", ["prisma/seed.ts"]);
} else {
  throw new Error("Choose a supported database operation: status, migrate or seed.");
}

function runPrisma(args: string[]) {
  runCommand("prisma/build/index.js", args);
}

function runCommand(packagePath: string, args: string[]) {
  const executablePath = resolve("node_modules", packagePath);
  const result = spawnSync(process.execPath, [executablePath, ...args], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}
