import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());
const mockResendConstructor = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = { send: mockSend };

    constructor(apiKey: string) {
      mockResendConstructor(apiKey);
    }
  },
}));
vi.mock("server-only", () => ({}));

import {
  EmailDeliveryError,
  sendInvitationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

describe("Resend transactional email service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_not-a-real-secret";
    process.env.EMAIL_FROM = "FalconCare Hub <notifications@example.test>";
  });

  it("sends a branded invitation through Resend with the expiring accept link", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const acceptUrl = "https://care.example.test/invite/one-time-secret-token";
    const expiresAt = new Date("2026-10-17T12:00:00.000Z");

    await expect(
      sendInvitationEmail({
        to: "care.worker@example.test",
        organisationName: "Falcon <Carers>",
        role: "CARE_WORKER",
        acceptUrl,
        expiresAt,
      }),
    ).resolves.toEqual({ id: "email-id" });

    expect(mockResendConstructor).toHaveBeenCalledWith("re_test_not-a-real-secret");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "FalconCare Hub <notifications@example.test>",
        to: "care.worker@example.test",
        subject: "Invitation to Falcon <Carers>",
        html: expect.stringContaining("Falcon &lt;Carers&gt;"),
        text: expect.stringContaining(acceptUrl),
      }),
    );
    expect(mockSend.mock.calls[0][0].html).toContain("can only be used once");
  });

  it("sends the password reset email with its one-time secure link and expiry", async () => {
    mockSend.mockResolvedValue({ data: { id: "reset-email-id" }, error: null });
    const resetUrl = "https://care.example.test/reset-password#token=one-time-reset-token";
    const expiresAt = new Date("2026-10-10T21:00:00.000Z");

    await expect(
      sendPasswordResetEmail({
        to: "user@example.test",
        resetUrl,
        expiresAt,
      }),
    ).resolves.toEqual({ id: "reset-email-id" });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your FalconCare Hub password",
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining("single-use link"),
      }),
    );
  });

  it("logs only safe diagnostic fields and surfaces a rejected Resend response", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: "Contains a private recipient and token value.",
      },
    });
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendInvitationEmail({
        to: "private.person@example.test",
        organisationName: "Falcon Carers",
        role: "CARE_WORKER",
        acceptUrl: "https://care.example.test/invite/secret-token",
        expiresAt: new Date("2026-10-17T12:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);

    expect(diagnostic).toHaveBeenCalledTimes(1);
    expect(diagnostic).toHaveBeenCalledWith("Resend transactional email delivery failed", {
      code: "validation_error",
      statusCode: 422,
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private.person@example.test");
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("secret-token");
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private recipient");
  });

  it("surfaces transport exceptions without logging their message or recipient data", async () => {
    mockSend.mockRejectedValue(new Error("transport failure for private.person@example.test"));
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendPasswordResetEmail({
        to: "private.person@example.test",
        resetUrl: "https://care.example.test/reset-password#token=private-reset-token",
        expiresAt: new Date("2026-10-10T21:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);

    expect(diagnostic).toHaveBeenCalledWith("Resend transactional email delivery failed", {
      code: "Error",
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private.person@example.test");
  });

  it("requires a Resend API key and sender without constructing the SDK", async () => {
    delete process.env.RESEND_API_KEY;
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendPasswordResetEmail({
        to: "user@example.test",
        resetUrl: "https://care.example.test/reset-password#token=preview-token",
        expiresAt: new Date("2026-10-10T21:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(mockResendConstructor).not.toHaveBeenCalled();
    expect(diagnostic).toHaveBeenCalledWith(
      "Resend transactional email is not configured",
      { missing: ["RESEND_API_KEY"] },
    );
  });
});
