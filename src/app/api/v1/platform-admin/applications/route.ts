import { NextResponse } from "next/server";
import type { ApplicationStatus } from "@prisma/client";
import { jsonError, privateJson } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPlatformPermission } from "@/lib/permissions";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

/**
 * GET /api/v1/platform-admin/applications
 * List organisation applications (platform admin only)
 */
export async function GET(request: Request) {
  try {
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:read");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const where = {
      ...(status ? { status: status as "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" as const } },
              { tradingName: { contains: search, mode: "insensitive" as const } },
              { primaryContactEmail: { contains: search, mode: "insensitive" as const } },
              { primaryContactName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [applications, total, statusCounts] = await Promise.all([
      db.organisationApplication.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          tradingName: true,
          primaryContactName: true,
          primaryContactEmail: true,
          careServiceTypes: true,
          estimatedStaffCount: true,
          estimatedBranchCount: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewedBy: {
            select: { name: true },
          },
          createdAt: true,
        },
        orderBy: [
          { status: "asc" }, // SUBMITTED first
          { submittedAt: "asc" }, // Oldest first
        ],
        take: limit,
        skip: offset,
      }),
      db.organisationApplication.count({ where }),
      db.organisationApplication.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    const counts = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      ...Object.fromEntries(statusCounts.map((s: { status: ApplicationStatus; _count: number }) => [s.status, s._count])),
    };

    return privateJson({
      data: applications,
      pagination: { total, limit, offset },
      counts,
    });
  } catch (error) {
    return jsonError(error);
  }
}
