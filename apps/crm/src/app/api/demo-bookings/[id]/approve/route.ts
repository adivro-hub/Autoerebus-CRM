import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { sendNotification } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/demo-bookings/[id]/approve
 * Only supervisor of the team or super admin can approve
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const currentUserId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";

  const booking = await prisma.demoBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Rezervarea nu există" }, { status: 404 });
  }

  if (booking.status !== "PENDING") {
    return NextResponse.json({ error: "Rezervarea nu este în așteptare" }, { status: 400 });
  }

  // Check permission: must be supervisor for this team or super admin
  if (!isSuperAdmin) {
    const isSupervisor = await prisma.teamMember.findFirst({
      where: { userId: currentUserId, teamId: booking.teamId, role: "SUPERVISOR" },
    });
    if (!isSupervisor) {
      return NextResponse.json(
        { error: "Doar supervizorii echipei pot aproba rezervări" },
        { status: 403 }
      );
    }
  }

  const approved = await prisma.demoBooking.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: currentUserId,
      approvedAt: new Date(),
    },
    include: {
      vehicle: { select: { title: true, brand: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await prisma.auditLog
    .create({
      data: {
        action: "DEMO_BOOKING_APPROVED",
        entity: "DemoBooking",
        entityId: id,
        userId: currentUserId,
      },
    })
    .catch(() => {});

  // Notify recipient if it's a user
  if (approved.user) {
    const supervisor = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { firstName: true, lastName: true },
    });
    sendNotification({
      userId: approved.user.id,
      type: "DEMO_BOOKING_APPROVED",
      channels: ["IN_APP", "EMAIL"],
      templateKeys: { email: "demo_booking_approved" },
      data: {
        recipientName: `${approved.user.firstName} ${approved.user.lastName}`,
        vehicleTitle: approved.vehicle.title || "—",
        startDate: approved.startDate,
        endDate: approved.endDate,
        supervisorName: supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : "Supervizor",
        link: `/demo-bookings/${id}`,
      },
      link: `/demo-bookings/${id}`,
      metadata: { bookingId: id },
      fallback: {
        title: "Rezervarea ta a fost aprobată",
        message: `Rezervarea pentru ${approved.vehicle.title} a fost aprobată.`,
      },
    }).catch((e) => console.error("[Notify:approve] error:", e));
  }

  return NextResponse.json({ success: true, booking: approved });
}
