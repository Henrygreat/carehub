import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveTenantContext, AuthenticationRequiredError } from "@/lib/tenant";
import { pilotFeedbackSchema } from "@/lib/validation";
import { auth } from "@/auth";

const FEEDBACK_PAGE_SIZE = 20;

/**
 * GET /api/v1/feedback
 * List pilot feedback for the current organisation
 * Platform admins can see all feedback across organisations
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationRequiredError();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const category = searchParams.get("category");
    const pageParam = searchParams.get("page") ?? "1";

    if (!/^[1-9]\d{0,6}$/.test(pageParam)) {
      return validationError({ page: ["Page must be a positive integer."] });
    }
    const page = Number.parseInt(pageParam, 10);
    const skip = (page - 1) * FEEDBACK_PAGE_SIZE;

    // Check if user is platform admin
    const user = await db.user.findUnique({
      where: { id: session.user.id, disabledAt: null },
      select: { isPlatformAdmin: true },
    });

    let organisationFilter: { organisationId?: string } = {};

    // If not platform admin, scope to their organisation
    if (!user?.isPlatformAdmin) {
      const context = await resolveTenantContext(session);
      organisationFilter = { organisationId: context.organisation.id };
    }

    const where = {
      ...organisationFilter,
      ...(status ? { status: status as "NEW" | "TRIAGED" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX" | "DUPLICATE" } : {}),
      ...(severity ? { severity: severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SUGGESTION" } : {}),
      ...(category ? { category: category as "BUG" | "USABILITY" | "PERFORMANCE" | "SECURITY" | "DATA" | "FEATURE" | "DOCUMENTATION" | "OTHER" } : {}),
    };

    const [total, data] = await db.$transaction([
      db.pilotFeedback.count({ where }),
      db.pilotFeedback.findMany({
        where,
        select: {
          id: true,
          category: true,
          severity: true,
          status: true,
          featureArea: true,
          title: true,
          createdAt: true,
          organisation: {
            select: { id: true, name: true },
          },
          submittedBy: {
            select: { id: true, name: true },
          },
          submittedByRole: true,
        },
        orderBy: [
          { status: "asc" }, // NEW first
          { severity: "asc" }, // CRITICAL first
          { createdAt: "desc" },
        ],
        skip,
        take: FEEDBACK_PAGE_SIZE,
      }),
    ]);

    return privateJson({
      data,
      pagination: {
        page,
        pageSize: FEEDBACK_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / FEEDBACK_PAGE_SIZE),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/feedback
 * Submit new pilot feedback
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationRequiredError();
    }

    const parsed = pilotFeedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const input = parsed.data;

    // Get user's current context (may be platform admin without org)
    let organisationId: string | null = null;
    let submittedByRole: "PLATFORM_ADMIN" | "ORG_ADMIN" | "MANAGER" | "COORDINATOR" | "CARE_WORKER" = "CARE_WORKER";

    // Check if platform admin
    const user = await db.user.findUnique({
      where: { id: session.user.id, disabledAt: null },
      select: { isPlatformAdmin: true },
    });

    if (user?.isPlatformAdmin) {
      submittedByRole = "PLATFORM_ADMIN";
    } else {
      // Get organisation context
      const context = await resolveTenantContext(session);
      organisationId = context.organisation.id;
      submittedByRole = context.membership.role;
    }

    const feedback = await db.pilotFeedback.create({
      data: {
        organisationId,
        submittedById: session.user.id,
        submittedByRole,
        category: input.category,
        severity: input.severity,
        featureArea: input.featureArea,
        workflow: input.workflow,
        title: input.title,
        description: input.description,
        reproductionSteps: input.reproductionSteps,
        expectedBehavior: input.expectedBehavior,
        actualBehavior: input.actualBehavior,
        browserInfo: input.browserInfo,
        screenResolution: input.screenResolution,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        status: "NEW",
      },
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: feedback,
        message: "Thank you for your feedback. It has been submitted for review.",
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
