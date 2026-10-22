import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveTenantContext, AuthenticationRequiredError } from "@/lib/tenant";
import { pilotFeedbackUpdateSchema } from "@/lib/validation";
import { auth } from "@/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/feedback/[id]
 * Get details of a specific feedback item
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationRequiredError();
    }

    const { id } = await params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid feedback ID." }, { status: 400 });
    }

    // Check if platform admin
    const user = await db.user.findUnique({
      where: { id: session.user.id, disabledAt: null },
      select: { isPlatformAdmin: true },
    });

    let organisationFilter: { organisationId?: string } = {};

    if (!user?.isPlatformAdmin) {
      const context = await resolveTenantContext(session);
      organisationFilter = { organisationId: context.organisation.id };
    }

    const feedback = await db.pilotFeedback.findFirst({
      where: {
        id,
        ...organisationFilter,
      },
      select: {
        id: true,
        category: true,
        severity: true,
        status: true,
        featureArea: true,
        workflow: true,
        title: true,
        description: true,
        reproductionSteps: true,
        expectedBehavior: true,
        actualBehavior: true,
        browserInfo: true,
        screenResolution: true,
        resolution: true,
        resolvedAt: true,
        relatedEntityType: true,
        relatedEntityId: true,
        attachments: true,
        internalNotes: user?.isPlatformAdmin ? true : false, // Only platform admin sees internal notes
        createdAt: true,
        updatedAt: true,
        organisation: {
          select: { id: true, name: true },
        },
        submittedBy: {
          select: { id: true, name: true, email: true },
        },
        submittedByRole: true,
        resolvedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    return privateJson({ data: feedback });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/v1/feedback/[id]
 * Update feedback status or resolution (platform admin only)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationRequiredError();
    }

    const { id } = await params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid feedback ID." }, { status: 400 });
    }

    // Only platform admin can update feedback
    const user = await db.user.findUnique({
      where: { id: session.user.id, disabledAt: null },
      select: { isPlatformAdmin: true },
    });

    if (!user?.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
    }

    const parsed = pilotFeedbackUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const input = parsed.data;

    // Check feedback exists
    const existing = await db.pilotFeedback.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    // Build update data
    const updateData: {
      status?: "NEW" | "TRIAGED" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX" | "DUPLICATE";
      severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SUGGESTION";
      resolution?: string | null;
      internalNotes?: string | null;
      resolvedAt?: Date | null;
      resolvedById?: string | null;
    } = {};

    if (input.status) {
      updateData.status = input.status;

      // Set resolution fields when status changes to RESOLVED or WONT_FIX
      if (input.status === "RESOLVED" || input.status === "WONT_FIX") {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = session.user.id;
      } else if (existing.status === "RESOLVED" || existing.status === "WONT_FIX") {
        // If reopening, clear resolution fields
        updateData.resolvedAt = null;
        updateData.resolvedById = null;
      }
    }

    if (input.severity) {
      updateData.severity = input.severity;
    }

    if (input.resolution !== undefined) {
      updateData.resolution = input.resolution;
    }

    if (input.internalNotes !== undefined) {
      updateData.internalNotes = input.internalNotes;
    }

    const updated = await db.pilotFeedback.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        status: true,
        severity: true,
        resolution: true,
        resolvedAt: true,
        updatedAt: true,
      },
    });

    return privateJson({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}
