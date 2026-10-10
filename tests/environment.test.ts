import { describe, expect, it } from "vitest";
import {
  getPrismaConfigDatabaseUrl,
  isPlaceholderDatabaseUrl,
  PRISMA_OFFLINE_DATABASE_URL,
  requireDatabaseUrl,
} from "../src/lib/environment";

describe("offline Prisma configuration", () => {
  it.each(["generate", "validate", "format"])(
    "allows the offline URL for prisma %s",
    (command) => {
      expect(getPrismaConfigDatabaseUrl(undefined, [command])).toBe(
        PRISMA_OFFLINE_DATABASE_URL,
      );
      expect(
        getPrismaConfigDatabaseUrl(PRISMA_OFFLINE_DATABASE_URL, [command]),
      ).toBe(PRISMA_OFFLINE_DATABASE_URL);
    },
  );

  it.each(["migrate", "db", "studio"])(
    "rejects missing or placeholder URLs for prisma %s",
    (command) => {
      expect(() => getPrismaConfigDatabaseUrl(undefined, [command])).toThrow(
        /DATABASE_URL is required/,
      );
      expect(() =>
        getPrismaConfigDatabaseUrl(PRISMA_OFFLINE_DATABASE_URL, [command]),
      ).toThrow(/placeholder DATABASE_URL is only allowed/);
    },
  );

  it("requires a real PostgreSQL URL for application database operations", () => {
    expect(isPlaceholderDatabaseUrl(PRISMA_OFFLINE_DATABASE_URL)).toBe(true);
    expect(() => requireDatabaseUrl(PRISMA_OFFLINE_DATABASE_URL)).toThrow(
      /real DATABASE_URL is required/,
    );
    expect(() => requireDatabaseUrl(undefined)).toThrow(
      /real DATABASE_URL is required/,
    );
    expect(requireDatabaseUrl("postgresql://user:pass@localhost:5432/app")).toBe(
      "postgresql://user:pass@localhost:5432/app",
    );
  });
});
