import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - list showroom appointments
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");

  const where: Record<string, unknown> = {};
  if (brand && brand !== "ALL") where.brand = brand;
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  try {
    const data = await prisma.showroomAppointment.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Showroom list error:", error);
    return NextResponse.json({ error: "Failed to list" }, { status: 500 });
  }
}

// POST - create new showroom appointment
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    customerId,
    leadId,
    scheduledAt,
    duration = 60,
    brand,
    agentId,
    contactName,
    contactPhone,
    contactEmail,
    notes,
  } = body;

  if (!customerId || !scheduledAt || !brand) {
    return NextResponse.json(
      { error: "customerId, scheduledAt și brand sunt obligatorii" },
      { status: 400 }
    );
  }

  try {
    const appointment = await prisma.showroomAppointment.create({
      data: {
        customerId,
        leadId: leadId || null,
        scheduledAt: new Date(scheduledAt),
        duration,
        brand,
        agentId: agentId || session.user.id || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
        status: "CONFIRMED",
      },
    });

    // Log activity on lead if present
    if (leadId) {
      await prisma.activity.create({
        data: {
          type: "MEETING",
          content: `Întâlnire showroom programată: ${new Date(scheduledAt).toLocaleDateString("ro-RO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          leadId,
          userId: session.user.id || null,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (error: unknown) {
    console.error("Showroom create error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
