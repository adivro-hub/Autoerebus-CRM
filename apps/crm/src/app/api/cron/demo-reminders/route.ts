import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import { sendNotification } from "@/lib/notifications/send";

/**
 * GET /api/cron/demo-reminders
 * Called by Vercel Cron every 30 minutes.
 * Checks CONFLICTED demo bookings and sends reminders at 24h/8h/3h before endDate.
 *
 * Security: protected by CRON_SECRET header (Vercel Cron sends it automatically).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    reminder24h: 0,
    reminder8h: 0,
    reminder3h: 0,
    autoCompleted: 0,
    errors: [] as string[],
  };

  try {
    // Find CONFLICTED bookings still active (endDate in future)
    const bookings = await prisma.demoBooking.findMany({
      where: {
        status: "CONFLICTED",
        endDate: { gt: now },
        userId: { not: null }, // Only notify users (not customers via CRM)
      },
      include: {
        vehicle: { select: { title: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    for (const booking of bookings) {
      if (!booking.user) continue;

      const msUntilEnd = booking.endDate.getTime() - now.getTime();
      const hoursUntilEnd = msUntilEnd / (1000 * 60 * 60);

      const recipientName = `${booking.user.firstName} ${booking.user.lastName}`;
      const templateData = {
        recipientName,
        vehicleTitle: booking.vehicle.title || "—",
        endDate: booking.endDate,
        endTime: booking.endDate.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }),
        link: `/demo-bookings/${booking.id}`,
      };

      try {
        // 24h reminder
        if (hoursUntilEnd <= 24 && hoursUntilEnd > 8 && !booking.reminder24hSentAt) {
          await sendNotification({
            userId: booking.user.id,
            type: "DEMO_BOOKING_REMINDER_24H",
            channels: ["IN_APP", "EMAIL"],
            templateKeys: { email: "demo_booking_reminder_24h" },
            data: templateData,
            link: templateData.link,
            metadata: { bookingId: booking.id },
            fallback: {
              title: "Reminder: mașina demo expiră în 24h",
              message: `Rezervarea pentru ${templateData.vehicleTitle} expiră în 24h.`,
            },
          });
          await prisma.demoBooking.update({
            where: { id: booking.id },
            data: { reminder24hSentAt: now },
          });
          results.reminder24h++;
        }

        // 8h reminder
        if (hoursUntilEnd <= 8 && hoursUntilEnd > 3 && !booking.reminder8hSentAt) {
          await sendNotification({
            userId: booking.user.id,
            type: "DEMO_BOOKING_REMINDER_8H",
            channels: ["IN_APP", "EMAIL"],
            templateKeys: { email: "demo_booking_reminder_8h" },
            data: templateData,
            link: templateData.link,
            metadata: { bookingId: booking.id },
            fallback: {
              title: "Reminder: mașina demo expiră în 8h",
              message: `Mașina ${templateData.vehicleTitle} trebuie returnată în 8h.`,
            },
          });
          await prisma.demoBooking.update({
            where: { id: booking.id },
            data: { reminder8hSentAt: now },
          });
          results.reminder8h++;
        }

        // 3h reminder - includes SMS (urgent)
        if (hoursUntilEnd <= 3 && hoursUntilEnd > 0 && !booking.reminder3hSentAt) {
          await sendNotification({
            userId: booking.user.id,
            type: "DEMO_BOOKING_REMINDER_3H",
            channels: ["IN_APP", "EMAIL", "SMS"],
            templateKeys: {
              email: "demo_booking_reminder_3h_email",
              sms: "demo_booking_reminder_3h_sms",
            },
            data: templateData,
            link: templateData.link,
            metadata: { bookingId: booking.id },
            fallback: {
              title: "URGENT: mașina demo expiră în 3h",
              message: `Mașina ${templateData.vehicleTitle} trebuie returnată în 3h.`,
              smsBody: `URGENT Autoerebus: returneaza ${templateData.vehicleTitle} pana la ${templateData.endTime}`,
            },
          });
          await prisma.demoBooking.update({
            where: { id: booking.id },
            data: { reminder3hSentAt: now },
          });
          results.reminder3h++;
        }
      } catch (e) {
        results.errors.push(`Booking ${booking.id}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    // Auto-complete expired bookings (APPROVED or CONFLICTED past endDate)
    const expired = await prisma.demoBooking.updateMany({
      where: {
        status: { in: ["APPROVED", "CONFLICTED"] },
        endDate: { lt: now },
      },
      data: { status: "COMPLETED" },
    });
    results.autoCompleted = expired.count;

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[Cron:demo-reminders] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
