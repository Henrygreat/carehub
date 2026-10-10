import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { requireDatabaseUrl } from "../src/lib/environment";

const operation = process.argv[2];
const databaseUrl = requireDatabaseUrl(process.env.DATABASE_URL);

if (operation === "migrate") {
  runCommand("prisma/build/index.js", ["migrate", "deploy"]);
} else if (operation === "seed") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed is disabled when NODE_ENV=production.");
  }
  runCommand("tsx/dist/cli.mjs", ["prisma/seed.ts"]);
} else {
  throw new Error("Choose a supported database operation: migrate or seed.");
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
