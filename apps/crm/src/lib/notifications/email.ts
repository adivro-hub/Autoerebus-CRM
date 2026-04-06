import { prisma } from "@autoerebus/database";

/**
 * Send an email via Mailjet API.
 * Logs to EmailLog table.
 * Gracefully fails (returns false) if credentials missing — doesn't throw.
 */
export async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}): Promise<boolean> {
  const apiKey = process.env.MJ_APIKEY_PUBLIC;
  const apiSecret = process.env.MJ_APIKEY_PRIVATE;
  const fromEmail = process.env.MJ_FROM_EMAIL || "noreply@autoerebus.ro";
  const fromName = process.env.MJ_FROM_NAME || "Autoerebus CRM";

  if (!apiKey || !apiSecret) {
    console.warn("[Email] Mailjet credentials missing, skipping send to:", params.to);
    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        status: "failed",
        provider: "mailjet",
        error: "Credentials missing",
      },
    }).catch(() => {});
    return false;
  }

  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64"),
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: params.to, Name: params.toName || params.to }],
            Subject: params.subject,
            TextPart: params.textBody || params.htmlBody.replace(/<[^>]+>/g, ""),
            HTMLPart: params.htmlBody,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Mailjet error:", response.status, errorText);
      await prisma.emailLog.create({
        data: {
          to: params.to,
          subject: params.subject,
          status: "failed",
          provider: "mailjet",
          error: errorText.slice(0, 500),
        },
      }).catch(() => {});
      return false;
    }

    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        status: "sent",
        provider: "mailjet",
      },
    }).catch(() => {});

    return true;
  } catch (error) {
    console.error("[Email] Send error:", error);
    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        status: "failed",
        provider: "mailjet",
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown",
      },
    }).catch(() => {});
    return false;
  }
}
