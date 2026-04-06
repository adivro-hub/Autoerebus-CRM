import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import { sendNotification } from "@/lib/notifications/send";

/**
 * GET /api/cron/test-drive-no-show
 * Runs every 30 minutes. Finds test drives scheduled in the past (more than 1h ago)
 * that are still SCHEDULED or CONFIRMED and marks them as NO_SHOW.
 *
 * Notifies the assigned agent if any.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Consider TDs that are 1h+ past scheduled time
  const threshold = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    const expiredTds = await prisma.testDrive.findMany({
      where: {
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { lt: threshold },
      },
      include: {
        vehicle: { select: { title: true } },
        customer: { select: { firstName: true, lastName: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let marked = 0;
    const notified: string[] = [];

    for (const td of expiredTds) {
      await prisma.testDrive.update({
        where: { id: td.id },
        data: { status: "NO_SHOW" },
      });
      marked++;

      await prisma.auditLog
        .create({
          data: {
            action: "TEST_DRIVE_AUTO_NO_SHOW",
            entity: "TestDrive",
            entityId: td.id,
            details: {
              scheduledAt: td.scheduledAt.toISOString(),
              customer: `${td.customer.firstName} ${td.customer.lastName}`,
              vehicle: td.vehicle?.title,
            },
          },
        })
        .catch(() => {});

      // Notify agent if assigned
      if (td.agent) {
        const recipient = `${td.customer.firstName} ${td.customer.lastName}`;
        await sendNotification({
          userId: td.agent.id,
          type: "TEST_DRIVE_REMINDER",
          channels: ["IN_APP"],
          data: {
            customerName: recipient,
            vehicleTitle: td.vehicle?.title || "—",
            scheduledAt: td.scheduledAt,
          },
          link: `/test-drives`,
          metadata: { testDriveId: td.id },
          fallback: {
            title: "Test drive marcat automat No Show",
            message: `Test drive-ul pentru ${recipient} (${td.vehicle?.title}) a fost marcat automat ca No Show (peste 1h întârziere).`,
          },
        }).catch((e) => console.error("[Notify:no-show] error:", e));
        notified.push(td.agent.id);
      }
    }

    return NextResponse.json({
      success: true,
      markedNoShow: marked,
      agentsNotified: notified.length,
    });
  } catch (error) {
    console.error("[Cron:test-drive-no-show] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
