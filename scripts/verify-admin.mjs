// Verify administrator account state.
// Run with: node --env-file-if-exists=.env scripts/verify-admin.mjs <email>
//
// This script checks if the admin account exists and has all the required
// properties for successful authentication.

import "dotenv/config";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/verify-admin.mjs <admin-email>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes("placeholder")) {
  console.error("DATABASE_URL must be set to a real database URL.");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient({ log: ["error"] });

try {
  console.log("\n=== Admin Account Verification ===\n");
  console.log("Checking email:", email);

  // Find user
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      emailVerified: true,
      disabledAt: true,
      sessionVersion: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.error("\n❌ PROBLEM: User not found with email:", email);
    console.error("   The administrator account does not exist.");
    console.error("   Run: npm run db:bootstrap-admin");
    process.exit(1);
  }

  console.log("\n✓ User found:");
  console.log("  ID:", user.id);
  console.log("  Name:", user.name);
  console.log("  Email:", user.email);
  console.log("  Email verified:", user.emailVerified ? "Yes" : "No");
  console.log("  Created:", user.createdAt.toISOString());

  // Check if disabled
  if (user.disabledAt) {
    console.error("\n❌ PROBLEM: User is DISABLED");
    console.error("   Disabled at:", user.disabledAt.toISOString());
    console.error("   The user cannot log in until enabled.");
    process.exit(1);
  }
  console.log("  Disabled: No");

  // Check password hash format
  const hash = user.passwordHash;
  console.log("\n✓ Password hash check:");
  console.log("  Length:", hash.length, hash.length === 60 ? "(correct)" : "(WRONG - should be 60)");
  console.log("  Prefix:", hash.substring(0, 7));
  console.log("  Valid bcrypt format:", /^\$2[aby]\$\d{2}\$/.test(hash) ? "Yes" : "NO");

  if (hash.length !== 60) {
    console.error("\n❌ PROBLEM: Password hash has incorrect length");
    console.error("   Expected 60 characters, got", hash.length);
    console.error("   This could happen if the hash was truncated or corrupted.");
    console.error("   You may need to reset the password.");
    process.exit(1);
  }

  if (!/^\$2[aby]\$\d{2}\$/.test(hash)) {
    console.error("\n❌ PROBLEM: Password hash has invalid format");
    console.error("   The hash should start with $2a$, $2b$, or $2y$");
    console.error("   You may need to reset the password.");
    process.exit(1);
  }

  // Check memberships
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      organisation: { select: { name: true, slug: true } },
    },
  });

  console.log("\n✓ Memberships check:");
  if (memberships.length === 0) {
    console.error("\n❌ PROBLEM: User has NO memberships");
    console.error("   The user must have at least one active membership to log in.");
    process.exit(1);
  }

  let hasActiveMembership = false;
  for (const m of memberships) {
    const status = m.active ? "ACTIVE" : "INACTIVE";
    console.log(`  - ${m.organisation.name} (${m.organisation.slug}): ${m.role} [${status}]`);
    if (m.active) hasActiveMembership = true;
  }

  if (!hasActiveMembership) {
    console.error("\n❌ PROBLEM: User has no ACTIVE memberships");
    console.error("   All memberships are inactive. At least one must be active.");

    // Offer to fix
    console.log("\n   To fix, you can run this SQL:");
    console.log(`   UPDATE memberships SET active = true WHERE "userId" = '${user.id}';`);
    process.exit(1);
  }

  // Test password verification
  console.log("\n✓ Password verification test:");
  const { compare } = await import("bcryptjs");

  // Test with a known value to ensure bcryptjs works
  const testHash = await (await import("bcryptjs")).hash("test", 12);
  const testResult = await compare("test", testHash);
  console.log("  bcryptjs self-test:", testResult ? "PASSED" : "FAILED");

  if (!testResult) {
    console.error("\n❌ PROBLEM: bcryptjs is not working correctly");
    console.error("   This is a system-level issue.");
    process.exit(1);
  }

  console.log("\n=== Summary ===\n");
  console.log("✓ User exists and is properly configured");
  console.log("✓ User is not disabled");
  console.log("✓ Password hash format is valid");
  console.log("✓ User has active membership(s)");
  console.log("✓ bcryptjs is working correctly");
  console.log("\nIf login still fails, the password being entered may not match");
  console.log("the password that was used when creating the account.");
  console.log("\nTo test password verification manually, you can add this to the script:");
  console.log('  const match = await compare("your-password", user.passwordHash);');

} catch (error) {
  console.error("Verification failed:", error.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
