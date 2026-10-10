import { EmploymentStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { createStaffListQuery, STAFF_PAGE_SIZE } from "@/lib/staff-query";
import { staffSchema } from "@/lib/validation";

function publicStaffFields(role: Role) {
  if (role === "COORDINATOR") {
    return {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      jobTitle: true,
      createdAt: true,
    } as const;
  }
  if (role === "CARE_WORKER") {
    return {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      employmentStatus: true,
      employmentType: true,
      jobTitle: true,
      startDate: true,
      contractedWeeklyHours: true,
      createdAt: true,
      updatedAt: true,
      membershipUserId: true,
    } as const;
  }
  return {
    id: true,
    employeeNumber: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    employmentStatus: true,
    employmentType: true,
    jobTitle: true,
    startDate: true,
    contractedWeeklyHours: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "staff:read");
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().slice(0, 100) ?? "";
    const statusValue = searchParams.get("status");
    if (
      statusValue &&
      !Object.values(EmploymentStatus).includes(statusValue as EmploymentStatus)
    ) {
      return validationError({ status: ["Invalid employment status."] });
    }
    const status = Object.values(EmploymentStatus).includes(statusValue as EmploymentStatus)
      ? (statusValue as EmploymentStatus)
      : undefined;
    const pageParameter = searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,6}$/.test(pageParameter)) {
      return validationError({ page: ["Page must be a positive integer."] });
    }
    const page = Number.parseInt(pageParameter, 10);
    const pagination = createStaffListQuery({
      organisationId: context.organisation.id,
      role: context.membership.role,
      userId: context.userId,
      query,
      status,
      page,
    });
    const [total, data] = await db.$transaction([
      db.staffProfile.count({ where: pagination.where }),
      db.staffProfile.findMany({
        where: pagination.where,
        select: publicStaffFields(context.membership.role),
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return privateJson({
      data: data.map((profile) => {
        return Object.fromEntries(
          Object.entries(profile).filter(([key]) => key !== "membershipUserId"),
        );
      }),
      pagination: {
        page,
        pageSize: STAFF_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / STAFF_PAGE_SIZE),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const context = await resolveTenantContext();
    assertPermission(context.membership, "staff:create");
    const parsed = staffSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;
    const staff = await db.$transaction(async (transaction) => {
      const matchingUser = await transaction.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: {
          id: true,
          memberships: {
            where: { organisationId: context.organisation.id, active: true },
            select: { id: true },
          },
        },
      });
      const created = await transaction.staffProfile.create({
        data: {
          ...input,
          organisationId: context.organisation.id,
          ...(matchingUser?.memberships.length
            ? { membershipUserId: matchingUser.id }
            : {}),
        },
      });
      await transaction.employmentRecord.create({
        data: {
          organisationId: context.organisation.id,
          staffProfileId: created.id,
          title: input.jobTitle,
          employmentType: input.employmentType,
          startDate: input.startDate,
          weeklyHours: input.contractedWeeklyHours,
        },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "staff.created",
          entityType: "StaffProfile",
          entityId: created.id,
        },
      });
      return created;
    });
    return NextResponse.json({ data: staff }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
