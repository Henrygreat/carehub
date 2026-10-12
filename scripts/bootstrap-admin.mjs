// One-time organisation administrator bootstrap.
// Plain ESM so it runs in the production image (no tsx / Prisma CLI needed).
// It only creates records. It never updates, resets or deletes existing data.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class BootstrapError extends Error {}

export function validateInput(input) {
  const email = String(input.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const password = String(input.password ?? "");
  const organisationName = String(input.organisationName ?? "").trim();
  const organisationSlug = String(input.organisationSlug ?? "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new BootstrapError("A valid administrator email address is required.");
  }
  if (!name || name.length > 120) {
    throw new BootstrapError("An administrator name (1-120 characters) is required.");
  }
  if (password.length < 12 || password.length > 128) {
    throw new BootstrapError("The administrator password must be 12-128 characters.");
  }
  if (/replace-with|replace-this|changeme|password123/i.test(password)) {
    throw new BootstrapError("Choose a real password, not an example value.");
  }
  if (!organisationName || organisationName.length > 120) {
    throw new BootstrapError("An organisation name is required.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organisationSlug) || organisationSlug.length > 60) {
    throw new BootstrapError("The organisation slug must be lowercase letters, numbers and hyphens.");
  }
  return { email, name, password, organisationName, organisationSlug };
}

export async function bootstrapAdmin(db, input, hashPassword) {
  const data = validateInput(input);

  return db.$transaction(
    async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new BootstrapError(
          "A user with that email already exists. Nothing was changed. Existing accounts are never modified by this script.",
        );
      }

      const organisation = await tx.organisation.findUnique({
        where: { slug: data.organisationSlug },
        select: { id: true, name: true },
      });
      if (organisation) {
        const existingAdmin = await tx.membership.findFirst({
          where: { organisationId: organisation.id, role: "ORG_ADMIN" },
          select: { id: true },
        });
        if (existingAdmin) {
          throw new BootstrapError(
            "This organisation already has an administrator. Bootstrap is one-time only; nothing was changed.",
          );
        }
      }

      const targetOrganisation =
        organisation ??
        (await tx.organisation.create({
          data: {
            name: data.organisationName,
            slug: data.organisationSlug,
            brandName: data.organisationName,
          },
          select: { id: true, name: true },
        }));

      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await hashPassword(data.password),
          emailVerified: new Date(),
        },
        select: { id: true },
      });
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organisationId: targetOrganisation.id,
          role: "ORG_ADMIN",
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          organisationId: targetOrganisation.id,
          actorUserId: user.id,
          actorMembershipId: membership.id,
          action: "organisation.admin_bootstrapped",
          entityType: "Membership",
          entityId: membership.id,
          metadata: { method: "bootstrap-script" },
        },
      });

      return { organisationName: targetOrganisation.name, reusedOrganisation: Boolean(organisation) };
    },
    { isolationLevel: "Serializable" },
  );
}

function requireRealDatabaseUrl(value) {
  if (!value || /placeholder/i.test(value)) {
    throw new BootstrapError(
      "A real DATABASE_URL is required. The offline placeholder cannot be used for bootstrap.",
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BootstrapError("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new BootstrapError("DATABASE_URL must be a postgres:// or postgresql:// URL.");
  }
}

function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    throw new BootstrapError(
      `${question.trim()} is not set and no interactive terminal is available. Provide it through the environment.`,
    );
  }
  return new Promise((resolve) => {
    let muted = false;
    const output = new Writable({
      write(chunk, _encoding, callback) {
        if (!muted) process.stdout.write(chunk);
        callback();
      },
    });
    const rl = createInterface({ input: process.stdin, output, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

async function main() {
  requireRealDatabaseUrl(process.env.DATABASE_URL);

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || (await ask("Administrator email: "));
  const name = process.env.BOOTSTRAP_ADMIN_NAME || (await ask("Administrator full name: "));
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (password) {
    // Trim environment variable to remove trailing newlines/whitespace that may have been
    // accidentally included when copying the value. Interactive input is not trimmed to
    // allow intentional spaces in passwords.
    password = password.trim();
  } else {
    password = await ask("Administrator password (hidden): ", { hidden: true });
    const confirmation = await ask("Confirm password (hidden): ", { hidden: true });
    if (password !== confirmation) throw new BootstrapError("The passwords did not match.");
  }

  const [{ PrismaClient }, { hash }] = await Promise.all([
    import("@prisma/client"),
    import("bcryptjs"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  try {
    const result = await bootstrapAdmin(
      db,
      {
        email,
        name,
        password,
        organisationName: process.env.BOOTSTRAP_ORG_NAME || "Falcon Carers",
        organisationSlug: process.env.BOOTSTRAP_ORG_SLUG || "falcon-carers",
      },
      (value) => hash(value, 12),
    );
    console.info(
      `Administrator created for "${result.organisationName}" with the ORG_ADMIN role. ` +
        "Remove BOOTSTRAP_ADMIN_PASSWORD from the environment if you set it.",
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Expected errors carry safe messages; unexpected ones are reduced to their class name.
    console.error(
      "Administrator bootstrap failed:",
      error instanceof BootstrapError ? error.message : `unexpected ${error?.name ?? "error"} (no changes committed)`,
    );
    process.exitCode = 1;
  });
}
