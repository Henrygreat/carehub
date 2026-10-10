import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessStaffProfile } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { personalContactSchema, staffSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

function safeFields(role: Role) {
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
    membershipUserId: true,
  } as const;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "staff:read");
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    }
    const staff = await db.staffProfile.findFirst({
      where: { id, organisationId: context.organisation.id },
      select: safeFields(context.membership.role),
    });
    if (
      !staff ||
      !canAccessStaffProfile(
        {
          role: context.membership.role,
          userId: context.userId,
          organisationId: context.organisation.id,
        },
        {
          organisationId: context.organisation.id,
          membershipUserId: "membershipUserId" in staff ? staff.membershipUserId : null,
        },
      )
    ) {
      return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    }
    const data = Object.fromEntries(
      Object.entries(staff).filter(([key]) => key !== "membershipUserId"),
    );
    return privateJson({ data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const context = await resolveTenantContext();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    }
    const current = await db.staffProfile.findFirst({
      where: { id, organisationId: context.organisation.id },
      select: { id: true, membershipUserId: true, employmentStatus: true },
    });
    if (!current) return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    if (
      context.membership.role === "CARE_WORKER" &&
      current.membershipUserId !== context.userId
    ) {
      return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    }

    const body: unknown = await request.json();
    const personalEdit =
      context.membership.role === "CARE_WORKER" &&
      current.membershipUserId === context.userId;
    if (personalEdit) {
      const parsed = personalContactSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error.flatten());
      const updated = await db.$transaction(async (transaction) => {
        const result = await transaction.staffProfile.update({
          where: { id_organisationId: { id, organisationId: context.organisation.id } },
          data: parsed.data,
          select: { id: true, email: true, phone: true },
        });
        await transaction.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "staff.contact_updated",
            entityType: "StaffProfile",
            entityId: id,
            metadata: { fields: Object.keys(parsed.data) },
          },
        });
        return result;
      });
      return NextResponse.json({ data: updated });
    }

    assertPermission(context.membership, "staff:update");
    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());
    if (parsed.data.employmentStatus !== current.employmentStatus) {
      assertPermission(context.membership, "staff:deactivate");
    }

    const updated = await db.$transaction(async (transaction) => {
      const result = await transaction.staffProfile.update({
        where: { id_organisationId: { id, organisationId: context.organisation.id } },
        data: parsed.data,
      });
      await transaction.employmentRecord.upsert({
        where: {
          staffProfileId_organisationId_startDate: {
            staffProfileId: id,
            organisationId: context.organisation.id,
            startDate: parsed.data.startDate,
          },
        },
        create: {
          organisationId: context.organisation.id,
          staffProfileId: id,
          title: parsed.data.jobTitle,
          employmentType: parsed.data.employmentType,
          startDate: parsed.data.startDate,
          weeklyHours: parsed.data.contractedWeeklyHours,
        },
        update: {
          title: parsed.data.jobTitle,
          employmentType: parsed.data.employmentType,
          weeklyHours: parsed.data.contractedWeeklyHours,
        },
      });
      if (
        current.membershipUserId &&
        parsed.data.employmentStatus !== current.employmentStatus
      ) {
        await transaction.membership.updateMany({
          where: {
            userId: current.membershipUserId,
            organisationId: context.organisation.id,
          },
          data: { active: parsed.data.employmentStatus !== "INACTIVE" },
        });
      }
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action:
            parsed.data.employmentStatus === "INACTIVE" &&
            parsed.data.employmentStatus !== current.employmentStatus
              ? "staff.deactivated"
              : "staff.updated",
          entityType: "StaffProfile",
          entityId: id,
          metadata: { fields: Object.keys(parsed.data) },
        },
      });
      return result;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}
