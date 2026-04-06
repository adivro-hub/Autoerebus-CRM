import { prisma } from "@autoerebus/database";
import { findBookingsConflictingWithTestDrive } from "./demo-booking-conflict";
import { sendNotification } from "./notifications/send";

/**
 * Called when a new test drive is created/confirmed.
 * Finds any approved demo bookings that conflict with the test drive,
 * marks them as CONFLICTED, and sends notifications to affected users.
 */
export async function handleTestDriveConflictWithDemoBookings(
  testDriveId: string,
  vehicleId: string,
  scheduledAt: Date,
  duration: number = 30
): Promise<number> {
  try {
    const conflicts = await findBookingsConflictingWithTestDrive(vehicleId, scheduledAt, duration);
    if (conflicts.length === 0) return 0;

    // Mark all as CONFLICTED and notify
    for (const booking of conflicts) {
      await prisma.demoBooking.update({
        where: { id: booking.id },
        data: {
          status: "CONFLICTED",
          conflictingTestDriveId: testDriveId,
        },
      });

      await prisma.auditLog
        .create({
          data: {
            action: "DEMO_BOOKING_CONFLICTED",
            entity: "DemoBooking",
            entityId: booking.id,
            details: { testDriveId, vehicleId, scheduledAt: scheduledAt.toISOString() },
          },
        })
        .catch(() => {});

      const recipientName = booking.user
        ? `${booking.user.firstName} ${booking.user.lastName}`
        : booking.customer
          ? `${booking.customer.firstName} ${booking.customer.lastName}`
          : "Utilizator";

      const templateData = {
        recipientName,
        vehicleTitle: booking.vehicle.title || "—",
        startDate: booking.startDate,
        endDate: booking.endDate,
        testDriveDate: scheduledAt,
        link: `/demo-bookings/${booking.id}`,
      };

      // Notify the booking user if it's a CRM user
      if (booking.user) {
        // Check how close we are to the end date — if less than 3h, include SMS
        const now = new Date();
        const msUntilEnd = booking.endDate.getTime() - now.getTime();
        const hoursUntilEnd = msUntilEnd / (1000 * 60 * 60);

        const channels: ("IN_APP" | "EMAIL" | "SMS")[] = ["IN_APP", "EMAIL"];
        if (hoursUntilEnd <= 3) channels.push("SMS");

        sendNotification({
          userId: booking.user.id,
          type: "DEMO_BOOKING_CONFLICTED",
          channels,
          templateKeys: {
            email: "demo_booking_conflicted",
            sms: "demo_booking_reminder_3h_sms",
          },
          data: templateData,
          link: `/demo-bookings/${booking.id}`,
          metadata: { bookingId: booking.id, testDriveId },
          fallback: {
            title: "Conflict: test drive programat pe mașina ta",
            message: `Un test drive a fost programat pentru ${templateData.vehicleTitle}. Trebuie să returnezi mașina până la ora programată.`,
            smsBody: `URGENT: returneaza ${templateData.vehicleTitle} - test drive programat`,
          },
        }).catch((e) => console.error("[Notify:conflict] error:", e));
      }

      // Also notify team supervisors
      const supervisors = await prisma.teamMember.findMany({
        where: { teamId: booking.teamId, role: "SUPERVISOR" },
        select: { userId: true },
      });

      for (const s of supervisors) {
        sendNotification({
          userId: s.userId,
          type: "DEMO_BOOKING_CONFLICTED",
          channels: ["IN_APP"],
          data: templateData,
          link: `/demo-bookings/${booking.id}`,
          metadata: { bookingId: booking.id, testDriveId },
          fallback: {
            title: "Conflict rezervare demo cu test drive",
            message: `Rezervarea lui ${recipientName} pentru ${templateData.vehicleTitle} intră în conflict cu un test drive.`,
          },
        }).catch((e) => console.error("[Notify:supervisor-conflict] error:", e));
      }
    }

    return conflicts.length;
  } catch (e) {
    console.error("[handleTestDriveConflict] error:", e);
    return 0;
  }
}
