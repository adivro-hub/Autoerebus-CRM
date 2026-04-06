import { prisma } from "@autoerebus/database";
import { getRenderedTemplate } from "./templates";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

type Channel = "IN_APP" | "EMAIL" | "SMS";

interface SendNotificationOptions {
  userId: string;
  type: string; // NotificationType enum value
  channels: Channel[];
  templateKeys?: {
    inApp?: string;
    email?: string;
    sms?: string;
  };
  data: Record<string, string | number | Date | null | undefined>;
  link?: string;
  metadata?: Record<string, unknown>;
  // Fallback messages if template missing
  fallback?: {
    title?: string;
    message?: string;
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
  };
}

/**
 * Send a notification to a user across specified channels.
 * Creates a Notification record and fires email/SMS as needed.
 */
export async function sendNotification(options: SendNotificationOptions) {
  const { userId, type, channels, templateKeys = {}, data, link, metadata, fallback = {} } = options;

  // Fetch user for email/phone
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, firstName: true, lastName: true },
  });

  if (!user) {
    console.warn("[Notification] User not found:", userId);
    return null;
  }

  // Render in-app title/message
  let title = fallback.title || "Notificare";
  let message = fallback.message || "";

  if (templateKeys.inApp) {
    const tpl = await getRenderedTemplate(templateKeys.inApp, data);
    if (tpl) {
      title = tpl.subject || title;
      message = tpl.body;
    }
  }

  // Create in-app notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: type as any,
      title,
      message,
      link: link || null,
      channels,
      metadata: metadata as any,
    },
  });

  const updates: any = {};

  // Send email
  if (channels.includes("EMAIL") && user.email) {
    let emailSubject = fallback.emailSubject || title;
    let emailBody = fallback.emailBody || message;

    if (templateKeys.email) {
      const tpl = await getRenderedTemplate(templateKeys.email, data);
      if (tpl) {
        emailSubject = tpl.subject || emailSubject;
        emailBody = tpl.body;
      }
    }

    // Convert plain text body to simple HTML with line breaks
    const htmlBody = emailBody
      .split("\n")
      .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");

    const sent = await sendEmail({
      to: user.email,
      toName: `${user.firstName} ${user.lastName}`,
      subject: emailSubject,
      htmlBody,
      textBody: emailBody,
    });

    if (sent) updates.emailSentAt = new Date();
  }

  // Send SMS
  if (channels.includes("SMS") && user.phone) {
    let smsBody = fallback.smsBody || message.slice(0, 160);

    if (templateKeys.sms) {
      const tpl = await getRenderedTemplate(templateKeys.sms, data);
      if (tpl) {
        smsBody = tpl.body;
      }
    }

    const sent = await sendSms({
      to: user.phone,
      message: smsBody,
    });

    if (sent) updates.smsSentAt = new Date();
  }

  if (Object.keys(updates).length > 0) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: updates,
    });
  }

  return notification;
}

/**
 * Send notification to all supervisors of a team.
 */
export async function notifyTeamSupervisors(
  teamId: string,
  options: Omit<SendNotificationOptions, "userId">
) {
  const supervisors = await prisma.teamMember.findMany({
    where: { teamId, role: "SUPERVISOR" },
    select: { userId: true },
  });

  const results = await Promise.all(
    supervisors.map((s) => sendNotification({ ...options, userId: s.userId }))
  );

  return results;
}
