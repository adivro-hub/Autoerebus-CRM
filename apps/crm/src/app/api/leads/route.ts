import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { handleTestDriveConflictWithDemoBookings } from "@/lib/demo-booking-trigger";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    phone,
    email,
    source,
    brand,
    vehicleId,
    notes,
    assignedToId,
    customerId: existingCustomerId,
    scheduleTestDrive,
    testDriveDate,
    sendBrochure,
    type,
  } = body;

  if (!firstName || !lastName || !brand || !source) {
    return NextResponse.json(
      { error: "Câmpuri obligatorii: nume, prenume, brand, sursă" },
      { status: 400 }
    );
  }

  try {
    // Use existing customer or find/create
    let customer = null;
    if (existingCustomerId) {
      customer = await prisma.customer.findUnique({ where: { id: existingCustomerId } });
    }
    if (!customer && email) {
      customer = await prisma.customer.findFirst({
        where: { email: email.toLowerCase() },
      });
    }
    if (!customer && phone) {
      customer = await prisma.customer.findFirst({ where: { phone } });
    }
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          phone: phone || null,
          email: email?.toLowerCase() || null,
          source,
          type: "INDIVIDUAL",
          createdById: session.user.id || null,
        },
      });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicleId || null,
        source,
        type: type || (scheduleTestDrive ? "TEST_DRIVE" : "GENERAL"),
        brand,
        status: "NEW",
        notes: notes || null,
        assignedToId: assignedToId || session.user.id || null,
      },
    });

    // Create deal in Lead Nou
    const leadNouStage = await prisma.pipelineStage.findFirst({
      where: { brand, pipelineType: "SALES", order: 0 },
    });

    if (leadNouStage) {
      const vehicle = vehicleId
        ? await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { price: true, discountPrice: true },
          })
        : null;

      await prisma.deal.create({
        data: {
          leadId: lead.id,
          stageId: leadNouStage.id,
          value: vehicle?.discountPrice ?? vehicle?.price ?? null,
          currency: "EUR",
          probability: 5,
          brand,
          assignedToId: assignedToId || session.user.id || null,
        },
      });
    }

    // Log activities
    await prisma.activity.create({
      data: {
        type: "CREATED",
        content: `Lead creat manual de ${session.user.name || "admin"} — ${source === "PHONE" ? "Telefon" : source === "WALK_IN" ? "Walk-in" : source}`,
        leadId: lead.id,
        userId: session.user.id || null,
      },
    }).catch(() => {});

    // Schedule test drive if requested
    if (scheduleTestDrive && testDriveDate && vehicleId) {
      const tdScheduledAt = new Date(testDriveDate);
      const td = await prisma.testDrive.create({
        data: {
          vehicleId,
          customerId: customer.id,
          scheduledAt: tdScheduledAt,
          duration: 30,
          contactName: `${firstName || customer.firstName} ${lastName || customer.lastName}`,
          contactPhone: phone || customer.phone,
          contactEmail: email || customer.email,
          notes: `[CRM] Test drive programat de ${session.user.name || "admin"}`,
          brand,
          status: "SCHEDULED",
        },
      });

      handleTestDriveConflictWithDemoBookings(td.id, vehicleId, tdScheduledAt, 30).catch((e) =>
        console.error("[TD conflict check] error:", e)
      );

      await prisma.activity.create({
        data: {
          type: "TEST_DRIVE",
          content: `Test drive programat: ${new Date(testDriveDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          leadId: lead.id,
          userId: session.user.id || null,
        },
      }).catch(() => {});
    }

    // Log brochure request
    if (sendBrochure && (email || customer.email)) {
      await prisma.activity.create({
        data: {
          type: "EMAIL",
          content: `📄 Broșură solicitată — va fi trimisă pe ${email || customer.email}`,
          leadId: lead.id,
          userId: session.user.id || null,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: lead });
  } catch (error: unknown) {
    console.error("Lead create error:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
