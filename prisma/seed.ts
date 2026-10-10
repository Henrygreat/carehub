import "dotenv/config";
import { EmploymentStatus, EmploymentType, PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed is disabled in production.");
  }
  const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("Set DEV_ADMIN_EMAIL and a DEV_ADMIN_PASSWORD of at least 12 characters.");
  }

  const organisation = await db.organisation.upsert({
    where: { slug: "falcon-carers-demo" },
    create: {
      name: "Falcon Carers",
      slug: "falcon-carers-demo",
      brandName: "Falcon Carers",
    },
    update: {},
  });
  const user = await db.user.upsert({
    where: { email },
    create: {
      name: "Alex Morgan",
      email,
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
    },
    update: { name: "Alex Morgan" },
  });
  await db.membership.upsert({
    where: {
      userId_organisationId: { userId: user.id, organisationId: organisation.id },
    },
    create: { userId: user.id, organisationId: organisation.id, role: Role.ORG_ADMIN },
    update: { role: Role.ORG_ADMIN, active: true },
  });

  const sampleStaff = [
    {
      employeeNumber: "FC-DEMO-001",
      firstName: "Jamie",
      lastName: "Taylor",
      email: "jamie.taylor@example.test",
      jobTitle: "Care worker",
      employmentType: EmploymentType.FULL_TIME,
      hours: 37.5,
    },
    {
      employeeNumber: "FC-DEMO-002",
      firstName: "Riley",
      lastName: "Morgan",
      email: "riley.morgan@example.test",
      jobTitle: "Senior care worker",
      employmentType: EmploymentType.PART_TIME,
      hours: 24,
    },
    {
      employeeNumber: "FC-DEMO-003",
      firstName: "Casey",
      lastName: "Reed",
      email: "casey.reed@example.test",
      jobTitle: "Support worker",
      employmentType: EmploymentType.ZERO_HOURS,
      hours: 0,
    },
  ];
  for (const [index, record] of sampleStaff.entries()) {
    const startDate = new Date(Date.UTC(2025, index, 6));
    const staff = await db.staffProfile.upsert({
      where: {
        employeeNumber_organisationId: {
          employeeNumber: record.employeeNumber,
          organisationId: organisation.id,
        },
      },
      create: {
        organisationId: organisation.id,
        employeeNumber: record.employeeNumber,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phone: `+44 7700 900${101 + index}`,
        jobTitle: record.jobTitle,
        employmentStatus: EmploymentStatus.ACTIVE,
        employmentType: record.employmentType,
        startDate,
        contractedWeeklyHours: record.hours,
      },
      update: {},
    });
    await db.employmentRecord.upsert({
      where: {
        staffProfileId_organisationId_startDate: {
          staffProfileId: staff.id,
          organisationId: organisation.id,
          startDate,
        },
      },
      create: {
        organisationId: organisation.id,
        staffProfileId: staff.id,
        title: record.jobTitle,
        employmentType: record.employmentType,
        startDate,
        weeklyHours: record.hours,
      },
      update: {},
    });
  }

  console.info("Development seed is ready.", { organisation: organisation.slug });
}

main()
  .catch((error: unknown) => {
    console.error("Development seed failed.", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
