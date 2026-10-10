import { db } from "@/lib/db";
import { createHash } from "node:crypto";

let lastCleanupAt = 0;

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  if (now.getTime() - lastCleanupAt > 60 * 60 * 1000) {
    await db.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    lastCleanupAt = now.getTime();
  }
  const [bucket] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE
    SET "windowStart" = CASE
          WHEN "rate_limit_buckets"."windowStart" < ${cutoff}
          THEN EXCLUDED."windowStart"
          ELSE "rate_limit_buckets"."windowStart"
        END,
        "count" = CASE
          WHEN "rate_limit_buckets"."windowStart" < ${cutoff}
          THEN 1
          ELSE "rate_limit_buckets"."count" + 1
        END
    RETURNING "count"
  `;

  if (bucket.count > limit) {
    throw new RateLimitError();
  }
}

export function enforceRequestRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowSeconds: number,
) {
  const forwardedFor =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const addressHash = createHash("sha256").update(forwardedFor.slice(0, 64)).digest("hex");
  return enforceRateLimit(`${namespace}:ip:${addressHash}`, limit, windowSeconds);
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitError";
  }
}
