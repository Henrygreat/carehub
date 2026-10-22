import "server-only";
import { Resend } from "resend";
import {
  renderInvitationEmail,
  renderOrganisationInvitationEmail,
  renderPasswordResetEmail,
} from "@/lib/email-templates";
import { requireEnvironmentVariable } from "@/lib/environment";

type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type InvitationEmail = {
  to: string;
  organisationName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  expiresAt: Date;
};

type OrganisationInvitationEmail = {
  to: string;
  organisationName: string;
  adminName: string;
  acceptUrl: string;
  expiresAt: Date;
};

export class EmailDeliveryError extends Error {
  constructor() {
    super("Transactional email could not be delivered.");
    this.name = "EmailDeliveryError";
  }
}

export async function sendInvitationEmail(input: InvitationEmail) {
  const template = renderInvitationEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    ...template,
  });
}

export async function sendPasswordResetEmail(input: PasswordResetEmail) {
  const template = renderPasswordResetEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    ...template,
  });
}

export async function sendOrganisationInvitationEmail(input: OrganisationInvitationEmail) {
  const template = renderOrganisationInvitationEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    ...template,
  });
}

async function sendTransactionalEmail(email: TransactionalEmail) {
  const missing = [
    ...(!process.env.RESEND_API_KEY?.trim() ? ["RESEND_API_KEY"] : []),
    ...(!process.env.EMAIL_FROM?.trim() ? ["EMAIL_FROM"] : []),
  ];
  if (missing.length > 0) {
    console.error("Resend transactional email is not configured", { missing });
    throw new EmailDeliveryError();
  }

  const apiKey = requireEnvironmentVariable(
    "RESEND_API_KEY",
    process.env.RESEND_API_KEY,
  );
  const from = requireEnvironmentVariable("EMAIL_FROM", process.env.EMAIL_FROM);

  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) {
      logSafeDeliveryDiagnostic(error);
      throw new EmailDeliveryError();
    }
    return data;
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    logSafeDeliveryDiagnostic(error);
    throw new EmailDeliveryError();
  }
}

function logSafeDeliveryDiagnostic(error: unknown) {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const code =
    typeof record.name === "string" && /^[a-zA-Z0-9_-]{1,48}$/.test(record.name)
      ? record.name
      : "provider_error";
  const statusCode =
    typeof record.statusCode === "number" &&
    Number.isInteger(record.statusCode) &&
    record.statusCode >= 100 &&
    record.statusCode <= 599
      ? record.statusCode
      : undefined;

  console.error("Resend transactional email delivery failed", {
    code,
    ...(statusCode ? { statusCode } : {}),
  });
}
