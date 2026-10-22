import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submitApplicationSchema } from "@/lib/validation";
import { enforceRequestRateLimit, RateLimitError } from "@/lib/rate-limit";

/**
 * POST /api/v1/applications
 * Submit a public organisation application (no authentication required)
 */
export async function POST(request: Request) {
  try {
    // Rate limit: 5 applications per hour per IP
    await enforceRequestRateLimit(request, "application:submit", 5, 60 * 60);

    const body = await request.json();
    const parsed = submitApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate pending/submitted applications with same email
    const existingApplication = await db.organisationApplication.findFirst({
      where: {
        primaryContactEmail: data.primaryContactEmail,
        status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] },
      },
      select: { id: true, status: true },
    });

    if (existingApplication) {
      return NextResponse.json(
        {
          error: "An application with this email address is already pending review.",
          existingStatus: existingApplication.status,
        },
        { status: 409 }
      );
    }

    // Check if user already exists (they should use org invitation flow instead)
    const existingUser = await db.user.findUnique({
      where: { email: data.primaryContactEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please contact support." },
        { status: 409 }
      );
    }

    // Create the application
    const application = await db.organisationApplication.create({
      data: {
        companyName: data.companyName.trim(),
        tradingName: data.tradingName?.trim() || null,
        companyRegistrationNo: data.companyRegistrationNo?.trim() || null,
        registeredAddressLine1: data.registeredAddressLine1?.trim() || null,
        registeredAddressLine2: data.registeredAddressLine2?.trim() || null,
        registeredCity: data.registeredCity?.trim() || null,
        registeredPostcode: data.registeredPostcode?.trim() || null,
        primaryContactName: data.primaryContactName.trim(),
        primaryContactEmail: data.primaryContactEmail,
        primaryContactPhone: data.primaryContactPhone?.trim() || null,
        careServiceTypes: data.careServiceTypes,
        cqcRegistrationNo: data.cqcRegistrationNo?.trim() || null,
        estimatedStaffCount: data.estimatedStaffCount,
        estimatedBranchCount: data.estimatedBranchCount,
        privacyNoticeAccepted: data.privacyNoticeAccepted,
        termsAccepted: data.termsAccepted,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: {
        id: true,
        companyName: true,
        primaryContactEmail: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: application.id,
          companyName: application.companyName,
          status: application.status,
          submittedAt: application.submittedAt,
          message: "Your application has been submitted successfully. We will review it and contact you shortly.",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many application submissions. Please try again later." },
        { status: 429 }
      );
    }
    console.error("Application submission error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
