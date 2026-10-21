import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPlatformPermission } from "@/lib/permissions";
import {
  createPlatformAuditLog,
  getClientIp,
  getUserAgent,
  resolvePlatformAdminContext,
} from "@/lib/platform-admin";
import { generateSlug } from "@/lib/slug";

/**
 * GET /api/v1/platform-admin/organisations
 * List all organisations (platform admin only)
 */
export async function GET(request: Request) {
  try {
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:read");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    const organisations = await db.organisation.findMany({
      where: {
        ...(status ? { status: status as "ACTIVE" | "SUSPENDED" | "PENDING" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { tradingName: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        tradingName: true,
        brandColour: true,
        status: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
        suspendedAt: true,
        _count: {
          select: {
            memberships: { where: { active: true } },
            branches: { where: { status: "ACTIVE" } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return privateJson({
      data: organisations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        tradingName: org.tradingName,
        brandColour: org.brandColour,
        status: org.status,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        createdAt: org.createdAt,
        suspendedAt: org.suspendedAt,
        activeUsers: org._count.memberships,
        activeBranches: org._count.branches,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/platform-admin/organisations
 * Create a new organisation directly (platform admin only)
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:create");

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
      return validationError({ fieldErrors: { name: ["Organisation name is required"] } });
    }

    const slug = await generateSlug(body.name);

    const organisation = await db.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: {
          name: body.name.trim(),
          slug,
          brandName: body.brandName?.trim() || null,
          brandColour: body.brandColour || "#0f766e",
          status: "ACTIVE",
          tradingName: body.tradingName?.trim() || null,
          companyRegistrationNo: body.companyRegistrationNo?.trim() || null,
          contactEmail: body.contactEmail?.trim() || null,
          contactPhone: body.contactPhone?.trim() || null,
          registeredAddressLine1: body.registeredAddressLine1?.trim() || null,
          registeredAddressLine2: body.registeredAddressLine2?.trim() || null,
          registeredCity: body.registeredCity?.trim() || null,
          registeredPostcode: body.registeredPostcode?.trim() || null,
          registeredCountry: body.registeredCountry?.trim() || "United Kingdom",
          operatingAddressLine1: body.operatingAddressLine1?.trim() || null,
          operatingAddressLine2: body.operatingAddressLine2?.trim() || null,
          operatingCity: body.operatingCity?.trim() || null,
          operatingPostcode: body.operatingPostcode?.trim() || null,
          operatingCountry: body.operatingCountry?.trim() || "United Kingdom",
          cqcProviderId: body.cqcProviderId?.trim() || null,
          cqcProviderName: body.cqcProviderName?.trim() || null,
          cqcRegisteredManager: body.cqcRegisteredManager?.trim() || null,
          timezone: body.timezone || "Europe/London",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      });

      // Create default head office branch
      await tx.branch.create({
        data: {
          organisationId: org.id,
          name: "Head Office",
          code: "HQ",
          status: "ACTIVE",
          isHeadOffice: true,
        },
      });

      return org;
    });

    await createPlatformAuditLog(context, "organisation.created", {
      entityType: "Organisation",
      entityId: organisation.id,
      targetOrgId: organisation.id,
      metadata: { name: organisation.name, slug: organisation.slug },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ data: organisation }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
