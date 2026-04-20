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
    testDriveVehicleId,
    scheduleShowroom,
    showroomDate,
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
        type: scheduleTestDrive ? "TEST_DRIVE" : (type || "GENERAL"),
        brand,
        status: "NEW",
        notes: notes || null,
        assignedToId: assignedToId || session.user.id || null,
      },
    });

    // Determine target pipeline stage:
    // - Test drive scheduled → "Test Drive Programat"
    // - Showroom only or nothing scheduled → "Contactat" (agent has contacted the customer)
    const hasScheduledTD = scheduleTestDrive && testDriveDate;
    const targetStageName = hasScheduledTD ? "Test Drive Programat" : "Contactat";

    let targetStage = await prisma.pipelineStage.findFirst({
      where: { brand, pipelineType: "SALES", name: targetStageName },
    });
    // Fallback to any stage with that name (not per brand)
    if (!targetStage) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { pipelineType: "SALES", name: targetStageName },
      });
    }
    // Final fallback: first stage
    if (!targetStage) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { brand, pipelineType: "SALES" },
        orderBy: { order: "asc" },
      });
    }

    if (targetStage) {
      const vehicle = vehicleId
        ? await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { price: true, discountPrice: true },
          })
        : null;

      await prisma.deal.create({
        data: {
          leadId: lead.id,
          stageId: targetStage.id,
          value: vehicle?.discountPrice ?? vehicle?.price ?? null,
          currency: "EUR",
          probability: hasScheduledTD ? 25 : 15,
          brand,
          assignedToId: assignedToId || session.user.id || null,
        },
      });

      // Update lead status to match
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "CONTACTED" },
      }).catch(() => {});
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
    if (scheduleTestDrive && testDriveDate) {
      const tdVehicleId = testDriveVehicleId || vehicleId;
      if (tdVehicleId) {
        const tdScheduledAt = new Date(testDriveDate);
        const td = await prisma.testDrive.create({
          data: {
            vehicleId: tdVehicleId,
            customerId: customer.id,
            leadId: lead.id,
            scheduledAt: tdScheduledAt,
            duration: 30,
            contactName: `${firstName || customer.firstName} ${lastName || customer.lastName}`,
            contactPhone: phone || customer.phone,
            contactEmail: email || customer.email,
            notes: `[CRM] Test drive programat de ${session.user.name || "admin"}`,
            brand,
            status: "CONFIRMED",
          },
        });

        handleTestDriveConflictWithDemoBookings(td.id, tdVehicleId, tdScheduledAt, 30).catch((e) =>
          console.error("[TD conflict check] error:", e)
        );

        await prisma.activity.create({
          data: {
            type: "TEST_DRIVE",
            content: `Test drive confirmat: ${new Date(testDriveDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
            leadId: lead.id,
            userId: session.user.id || null,
          },
        }).catch(() => {});
      }
    }

    // Schedule showroom appointment if requested
    if (scheduleShowroom && showroomDate) {
      const showScheduledAt = new Date(showroomDate);
      await prisma.showroomAppointment.create({
        data: {
          customerId: customer.id,
          leadId: lead.id,
          scheduledAt: showScheduledAt,
          duration: 60,
          brand,
          agentId: assignedToId || session.user.id || null,
          contactName: `${firstName || customer.firstName} ${lastName || customer.lastName}`,
          contactPhone: phone || customer.phone,
          contactEmail: email || customer.email,
          notes: `[CRM] Programare showroom de ${session.user.name || "admin"}`,
          status: "CONFIRMED",
        },
      }).catch((e) => console.error("[Showroom create] error:", e));

      await prisma.activity.create({
        data: {
          type: "MEETING",
          content: `Întâlnire showroom: ${new Date(showroomDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
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
