import { prisma } from "@autoerebus/database";

/**
 * Send SMS via Twilio API.
 * Logs to SmsLog. Fails gracefully.
 * Phone must be in E.164 format (+40...).
 */
export async function sendSms(params: { to: string; message: string }): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[SMS] Twilio credentials missing, skipping send to:", params.to);
    await prisma.smsLog.create({
      data: {
        to: params.to,
        message: params.message,
        status: "failed",
        provider: "twilio",
        error: "Credentials missing",
      },
    }).catch(() => {});
    return false;
  }

  // Normalize Romanian phone to E.164
  let toPhone = params.to.replace(/\s+/g, "").replace(/[-()]/g, "");
  if (toPhone.startsWith("0")) toPhone = "+40" + toPhone.slice(1);
  if (!toPhone.startsWith("+")) toPhone = "+" + toPhone;

  try {
    const body = new URLSearchParams({
      From: fromNumber,
      To: toPhone,
      Body: params.message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: body.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SMS] Twilio error:", response.status, errorText);
      await prisma.smsLog.create({
        data: {
          to: toPhone,
          message: params.message,
          status: "failed",
          provider: "twilio",
          error: errorText.slice(0, 500),
        },
      }).catch(() => {});
      return false;
    }

    await prisma.smsLog.create({
      data: {
        to: toPhone,
        message: params.message,
        status: "sent",
        provider: "twilio",
      },
    }).catch(() => {});

    return true;
  } catch (error) {
    console.error("[SMS] Send error:", error);
    await prisma.smsLog.create({
      data: {
        to: toPhone,
        message: params.message,
        status: "failed",
        provider: "twilio",
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown",
      },
    }).catch(() => {});
    return false;
  }
}
