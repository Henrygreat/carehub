export const PRISMA_OFFLINE_DATABASE_URL =
  "postgresql://placeholder:placeholder@127.0.0.1:5432/falconcare_placeholder?schema=public";

const offlinePrismaCommands = new Set(["generate", "validate", "format"]);

export function getPrismaConfigDatabaseUrl(
  databaseUrl: string | undefined,
  args: string[],
) {
  const command = args.find((argument) => !argument.startsWith("-"));
  const allowsOfflineUrl = command && offlinePrismaCommands.has(command);

  if (!databaseUrl) {
    if (allowsOfflineUrl) return PRISMA_OFFLINE_DATABASE_URL;
    throw new Error(
      "DATABASE_URL is required for Prisma database operations. Set a real PostgreSQL connection string; the offline placeholder is only allowed for generate, validate and format.",
    );
  }

  if (isPlaceholderDatabaseUrl(databaseUrl) && !allowsOfflineUrl) {
    throw new Error(
      "The placeholder DATABASE_URL is only allowed for Prisma generate, validate and format. Set a real PostgreSQL connection string before migrations or database operations.",
    );
  }

  return databaseUrl;
}

export function requireDatabaseUrl(
  databaseUrl: string | undefined,
  nodeEnv = process.env.NODE_ENV,
) {
  if (!databaseUrl || isPlaceholderDatabaseUrl(databaseUrl)) {
    throw new Error(
      "A real DATABASE_URL is required before using the database. The local Prisma placeholder cannot be used by the application, migrations or seed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.pathname.slice(1)
  ) {
    throw new Error(
      "DATABASE_URL must use postgres:// or postgresql:// and include a database name.",
    );
  }

  if (nodeEnv === "production") {
    if (!parsed.username || !parsed.password) {
      throw new Error(
        "Production DATABASE_URL must include database credentials.",
      );
    }
    if (
      ["placeholder", "example.com", "example.test"].some((value) =>
        databaseUrl.toLowerCase().includes(value),
      )
    ) {
      throw new Error(
        "Production DATABASE_URL contains example placeholder values. Configure the real Coolify PostgreSQL connection.",
      );
    }
  }

  return databaseUrl;
}

export function requireEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value?.trim()) {
    throw new Error(
      `${name} must be configured before this service can run. Set it in the local .env file or Coolify runtime environment.`,
    );
  }
  return value.trim();
}

export function requireAppUrl(value: string | undefined) {
  const appUrl = requireEnvironmentVariable("APP_URL", value);
  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    throw new Error("APP_URL must be a valid absolute http(s) URL.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
  ) {
    throw new Error(
      "APP_URL must use http(s), and production APP_URL must use HTTPS.",
    );
  }
  return parsed.origin;
}

export function requireAuthSecret(value: string | undefined) {
  const secret = requireEnvironmentVariable("AUTH_SECRET", value);
  if (secret.length < 32 || /replace-with|example|placeholder/i.test(secret)) {
    throw new Error(
      "AUTH_SECRET must be a non-placeholder secret containing at least 32 characters.",
    );
  }
  return secret;
}

export function isPlaceholderDatabaseUrl(value: string) {
  return value.toLowerCase().includes("placeholder");
}
