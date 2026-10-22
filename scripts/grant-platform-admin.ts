/**
 * Platform Admin Provisioning Script
 *
 * This script grants Platform Admin access to an existing user account.
 * It is idempotent, production-safe, and records all changes in the audit log.
 *
 * Usage:
 *   npx tsx scripts/grant-platform-admin.ts <email>
 *
 * Requirements:
 *   - DATABASE_URL environment variable must be set
 *   - User must already exist in the database
 *   - Confirmation is required before making changes
 *
 * This script:
 *   - Does NOT create new accounts
 *   - Does NOT modify passwords
 *   - Does NOT affect existing memberships
 *   - Records the privilege change in platform_audit_logs
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createInterface } from "readline";
import { requireDatabaseUrl } from "../src/lib/environment";

const SCRIPT_ACTOR_ID = "00000000-0000-0000-0000-000000000000"; // System actor

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: npx tsx scripts/grant-platform-admin.ts <email>");
    console.error("Example: npx tsx scripts/grant-platform-admin.ts admin@example.com");
    process.exit(1);
  }

  const databaseUrl = requireDatabaseUrl(process.env.DATABASE_URL);
  const db = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    // Step 1: Find the user
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        disabledAt: true,
        createdAt: true,
        memberships: {
          where: { active: true },
          select: {
            role: true,
            organisation: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    });

    if (!user) {
      console.error(`\nError: No user found with email "${email}"`);
      console.error("This script only modifies existing accounts. Please verify the email address.");
      process.exit(1);
    }

    // Step 2: Display current status
    console.log("\n=== User Account Details ===");
    console.log(`  ID:              ${user.id}`);
    console.log(`  Name:            ${user.name}`);
    console.log(`  Email:           ${user.email}`);
    console.log(`  Created:         ${user.createdAt.toISOString()}`);
    console.log(`  Status:          ${user.disabledAt ? "DISABLED" : "Active"}`);
    console.log(`  Platform Admin:  ${user.isPlatformAdmin ? "YES" : "No"}`);

    if (user.memberships.length > 0) {
      console.log("\n  Organisation Memberships:");
      for (const m of user.memberships) {
        console.log(`    - ${m.organisation.name} (${m.organisation.slug}) as ${m.role}`);
      }
    }

    // Step 3: Check if already a platform admin
    if (user.isPlatformAdmin) {
      console.log("\n[INFO] This user is already a Platform Admin. No changes required.");
      process.exit(0);
    }

    // Step 4: Require confirmation
    console.log("\n=== Action Required ===");
    console.log("This will grant Platform Admin privileges to the above user.");
    console.log("The user will be able to:");
    console.log("  - View and manage ALL organisations on the platform");
    console.log("  - Suspend and reactivate organisations");
    console.log("  - Invite new organisations to join");
    console.log("  - View platform-wide audit logs");
    console.log("\nExisting password, user ID, and memberships will be preserved.");

    const confirmed = await askConfirmation(
      `\nType the user's email to confirm: `,
      email,
    );

    if (!confirmed) {
      console.log("\n[CANCELLED] No changes were made.");
      process.exit(0);
    }

    // Step 5: Grant platform admin access
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { isPlatformAdmin: true },
      select: { id: true, email: true, isPlatformAdmin: true },
    });

    // Step 6: Record in platform audit log
    await db.platformAuditLog.create({
      data: {
        actorUserId: user.id, // Self-grant via script
        action: "user.platform_admin.granted",
        entityType: "User",
        entityId: user.id,
        metadata: {
          grantedVia: "grant-platform-admin.ts",
          grantedAt: new Date().toISOString(),
          environment: process.env.NODE_ENV ?? "unknown",
        },
      },
    });

    console.log("\n=== Success ===");
    console.log(`Platform Admin access has been granted to ${updatedUser.email}`);
    console.log(`isPlatformAdmin: ${updatedUser.isPlatformAdmin}`);
    console.log("\nThe change has been recorded in the platform audit log.");
    console.log("The user can now access /platform-admin after signing in.");
  } finally {
    await db.$disconnect();
  }
}

function askConfirmation(prompt: string, expectedValue: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === expectedValue.toLowerCase());
    });
  });
}

main().catch((error: unknown) => {
  console.error(
    "\n[ERROR] Script failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
