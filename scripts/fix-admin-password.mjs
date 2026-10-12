// Fix administrator password hash.
// Run with: node --env-file-if-exists=.env scripts/fix-admin-password.mjs <email>
//
// This script allows you to re-hash the administrator password. Use this if the
// original password was stored with trailing whitespace or other issues.
// Enter the password you INTENDED to use (the one you're trying to log in with).

import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/fix-admin-password.mjs <admin-email>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes("placeholder")) {
  console.error("DATABASE_URL must be set to a real database URL.");
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive terminal required for password input.");
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

const [{ PrismaClient }, { hash, compare }] = await Promise.all([
  import("@prisma/client"),
  import("bcryptjs"),
]);

const db = new PrismaClient({ log: ["error"] });

try {
  console.log("\n=== Fix Administrator Password ===\n");

  // Find user
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }

  console.log("User found:", user.name, `(${user.email})`);
  console.log("\nEnter the password you want to use (this will update the hash).");
  console.log("Make sure to enter it exactly as you want to type it when logging in.\n");

  const password = await ask("New password (hidden): ", { hidden: true });
  const confirmation = await ask("Confirm password (hidden): ", { hidden: true });

  if (password !== confirmation) {
    console.error("\nPasswords do not match.");
    process.exit(1);
  }

  if (password.length < 12 || password.length > 128) {
    console.error("\nPassword must be 12-128 characters.");
    process.exit(1);
  }

  // Check if the password already matches (maybe the issue is elsewhere)
  const alreadyMatches = await compare(password, user.passwordHash);
  if (alreadyMatches) {
    console.log("\n✓ This password already matches the stored hash!");
    console.log("  The login issue is not with the password.");
    console.log("  Run: npm run db:verify-admin", email);
    process.exit(0);
  }

  // Hash and update
  console.log("\nUpdating password hash...");
  const newHash = await hash(password, 12);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      sessionVersion: { increment: 1 }, // Invalidate existing sessions
    },
  });

  console.log("\n✓ Password hash updated successfully!");
  console.log("  You can now log in with the password you just entered.");

} catch (error) {
  console.error("\nFailed:", error.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
