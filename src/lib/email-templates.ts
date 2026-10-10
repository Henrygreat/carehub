type TemplateResult = { subject: string; html: string; text: string };

type InvitationTemplateInput = {
  organisationName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

type PasswordResetTemplateInput = {
  resetUrl: string;
  expiresAt: Date;
};

const navy = "#102b3a";
const teal = "#0f766e";
const muted = "#52616d";

export function renderInvitationEmail(input: InvitationTemplateInput): TemplateResult {
  const organisation = safeText(input.organisationName);
  const role = safeText(input.role.replaceAll("_", " ").toLowerCase());
  const acceptUrl = safeUrl(input.acceptUrl);
  const expiry = formatExpiry(input.expiresAt);

  return {
    subject: `Invitation to ${organisation}`,
    html: emailLayout({
      preheader: `You have been invited to join ${organisation} on FalconCare Hub.`,
      title: "A better way to work together",
      body: `<p>You have been invited to join <strong>${escapeHtml(organisation)}</strong> on FalconCare Hub as a ${escapeHtml(role)}.</p>
        <p>Use the secure link below to set up your account. This invitation can only be used once and expires ${escapeHtml(expiry)}.</p>`,
      buttonLabel: "Accept your invitation",
      buttonUrl: acceptUrl,
      footerNote: "If you were not expecting this invitation, you can safely ignore this email.",
    }),
    text: [
      `You have been invited to join ${organisation} on FalconCare Hub as a ${role}.`,
      "",
      `Accept your invitation: ${acceptUrl}`,
      "",
      `This single-use link expires ${expiry}.`,
      "If you were not expecting this invitation, you can safely ignore this email.",
    ].join("\n"),
  };
}

export function renderPasswordResetEmail(input: PasswordResetTemplateInput): TemplateResult {
  const resetUrl = safeUrl(input.resetUrl);
  const expiry = formatExpiry(input.expiresAt);

  return {
    subject: "Reset your FalconCare Hub password",
    html: emailLayout({
      preheader: "A secure link was requested to reset your FalconCare Hub password.",
      title: "Reset your password",
      body: `<p>We received a request to reset the password for your FalconCare Hub account.</p>
        <p>Choose a new password using the secure, single-use link below. The link expires ${escapeHtml(expiry)}.</p>`,
      buttonLabel: "Choose a new password",
      buttonUrl: resetUrl,
      footerNote: "If you did not request a password reset, no action is needed. Your password will remain unchanged.",
    }),
    text: [
      "We received a request to reset your FalconCare Hub password.",
      "",
      `Choose a new password: ${resetUrl}`,
      "",
      `This single-use link expires ${expiry}.`,
      "If you did not request a password reset, no action is needed.",
    ].join("\n"),
  };
}

function emailLayout(input: {
  preheader: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6f7;font-family:Arial,Helvetica,sans-serif;color:${navy};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f7;padding:36px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8ec;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 36px;background:${navy};">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td align="center" valign="middle" width="38" height="38" style="width:38px;height:38px;border-radius:11px;background:${teal};color:#ffffff;font-size:18px;font-weight:bold;">F</td>
              <td style="padding-left:12px;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.2px;">FalconCare Hub</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:38px 36px 28px;">
            <h1 style="margin:0 0 20px;color:${navy};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;">${escapeHtml(input.title)}</h1>
            <div style="color:${muted};font-size:15px;line-height:1.7;">${input.body}</div>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 20px;">
              <tr><td bgcolor="${teal}" style="border-radius:8px;">
                <a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;padding:13px 20px;border:1px solid ${teal};border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(input.buttonLabel)}</a>
              </td></tr>
            </table>
            <p style="margin:0;color:${muted};font-size:13px;line-height:1.65;">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(input.buttonUrl)}" style="color:${teal};word-break:break-all;">${escapeHtml(input.buttonUrl)}</a></p>
          </td></tr>
          <tr><td style="padding:20px 36px 28px;border-top:1px solid #edf1f3;">
            <p style="margin:0;color:#71808b;font-size:12px;line-height:1.65;">${escapeHtml(input.footerNote)}</p>
            <p style="margin:14px 0 0;color:#91a0a9;font-size:11px;line-height:1.5;">FalconCare Hub · Thoughtful tools for better care teams</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 200);
}

function safeUrl(value: string) {
  const url = new URL(value);
  const localDevelopmentHost =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localDevelopmentHost) {
    throw new Error("Transactional email links must use HTTPS.");
  }
  return url.toString();
}

function formatExpiry(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
