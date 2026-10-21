import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { branchAssignmentSchema, batchBranchAssignmentSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/branches/[id]/assignments
 * List all staff assignments for a branch
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:read");

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: { id: true },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const assignments = await db.branchAssignment.findMany({
      where: {
        branchId: id,
        ...(activeOnly ? { endDate: null } : {}),
      },
      select: {
        id: true,
        isPrimary: true,
        role: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobTitle: true,
            employmentStatus: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { staffProfile: { lastName: "asc" } }],
    });

    return privateJson({ data: assignments });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/branches/[id]/assignments
 * Assign staff to a branch (single or batch)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:assign_staff");

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found or is inactive." },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Check if batch or single assignment
    if (body.assignments && Array.isArray(body.assignments)) {
      // Batch assignment
      const parsed = batchBranchAssignmentSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.flatten());
      }

      const assignments = await db.$transaction(async (tx) => {
        const created = [];

        for (const assignment of parsed.data.assignments) {
          // Verify staff profile exists and belongs to this organisation
          const staffProfile = await tx.staffProfile.findFirst({
            where: {
              id: assignment.staffProfileId,
              organisationId: context.organisation.id,
            },
            select: { id: true, firstName: true, lastName: true },
          });

          if (!staffProfile) {
            throw new Error(`Staff profile not found: ${assignment.staffProfileId}`);
          }

          // Check for existing active assignment
          const existingAssignment = await tx.branchAssignment.findUnique({
            where: {
              branchId_staffProfileId: {
                branchId: id,
                staffProfileId: assignment.staffProfileId,
              },
            },
          });

          if (existingAssignment && !existingAssignment.endDate) {
            // Update existing assignment
            const updated = await tx.branchAssignment.update({
              where: { id: existingAssignment.id },
              data: {
                isPrimary: assignment.isPrimary,
                role: assignment.role,
              },
              select: {
                id: true,
                isPrimary: true,
                role: true,
                startDate: true,
              },
            });
            created.push(updated);
          } else {
            // Create new assignment
            const newAssignment = await tx.branchAssignment.create({
              data: {
                branchId: id,
                staffProfileId: assignment.staffProfileId,
                organisationId: context.organisation.id,
                isPrimary: assignment.isPrimary ?? false,
                role: assignment.role || null,
                startDate: assignment.startDate,
                endDate: assignment.endDate || null,
              },
              select: {
                id: true,
                isPrimary: true,
                role: true,
                startDate: true,
              },
            });
            created.push(newAssignment);
          }

          // If setting as primary, unset other primary assignments for this staff
          if (assignment.isPrimary) {
            await tx.branchAssignment.updateMany({
              where: {
                staffProfileId: assignment.staffProfileId,
                branchId: { not: id },
                isPrimary: true,
                endDate: null,
              },
              data: { isPrimary: false },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "branch.staff.assigned",
            entityType: "Branch",
            entityId: id,
            metadata: {
              count: created.length,
              staffProfileIds: parsed.data.assignments.map((a) => a.staffProfileId),
            },
          },
        });

        return created;
      });

      return NextResponse.json({ data: assignments }, { status: 201 });
    } else {
      // Single assignment
      const parsed = branchAssignmentSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.flatten());
      }

      const data = parsed.data;

      // Verify staff profile exists and belongs to this organisation
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          id: data.staffProfileId,
          organisationId: context.organisation.id,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!staffProfile) {
        return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
      }

      // Check for existing active assignment
      const existingAssignment = await db.branchAssignment.findUnique({
        where: {
          branchId_staffProfileId: {
            branchId: id,
            staffProfileId: data.staffProfileId,
          },
        },
      });

      if (existingAssignment && !existingAssignment.endDate) {
        return NextResponse.json(
          { error: "Staff is already assigned to this branch." },
          { status: 409 },
        );
      }

      const assignment = await db.$transaction(async (tx) => {
        // If setting as primary, unset other primary assignments for this staff
        if (data.isPrimary) {
          await tx.branchAssignment.updateMany({
            where: {
              staffProfileId: data.staffProfileId,
              isPrimary: true,
              endDate: null,
            },
            data: { isPrimary: false },
          });
        }

        const newAssignment = await tx.branchAssignment.create({
          data: {
            branchId: id,
            staffProfileId: data.staffProfileId,
            organisationId: context.organisation.id,
            isPrimary: data.isPrimary ?? false,
            role: data.role || null,
            startDate: data.startDate,
            endDate: data.endDate || null,
          },
          select: {
            id: true,
            isPrimary: true,
            role: true,
            startDate: true,
            staffProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "branch.staff.assigned",
            entityType: "BranchAssignment",
            entityId: newAssignment.id,
            metadata: {
              branchId: id,
              staffProfileId: data.staffProfileId,
              role: data.role,
            },
          },
        });

        return newAssignment;
      });

      return NextResponse.json({ data: assignment }, { status: 201 });
    }
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * DELETE /api/v1/branches/[id]/assignments
 * Remove staff assignment from a branch
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:assign_staff");

    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("assignmentId");
    const staffProfileId = url.searchParams.get("staffProfileId");

    if (!assignmentId && !staffProfileId) {
      return validationError({
        fieldErrors: { assignmentId: ["Assignment ID or staff profile ID is required"] },
      });
    }

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: { id: true },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const assignment = await db.branchAssignment.findFirst({
      where: {
        branchId: id,
        ...(assignmentId ? { id: assignmentId } : { staffProfileId: staffProfileId ?? undefined }),
        endDate: null,
      },
      select: { id: true, staffProfileId: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.branchAssignment.update({
        where: { id: assignment.id },
        data: { endDate: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "branch.staff.unassigned",
          entityType: "BranchAssignment",
          entityId: assignment.id,
          metadata: {
            branchId: id,
            staffProfileId: assignment.staffProfileId,
          },
        },
      });
    });

    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return jsonError(error);
  }
}
