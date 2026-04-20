import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - full lead details with activities
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
            images: { take: 1, orderBy: { order: "asc" } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        deals: {
          include: {
            stage: { select: { name: true, color: true } },
            assignedTo: { select: { firstName: true, lastName: true } },
          },
        },
        activities: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch additional vehicles if any
    let additionalVehicles: unknown[] = [];
    if (lead.additionalVehicleIds && lead.additionalVehicleIds.length > 0) {
      additionalVehicles = await prisma.vehicle.findMany({
        where: { id: { in: lead.additionalVehicleIds } },
        include: {
          make: { select: { name: true } },
          model: { select: { name: true } },
          images: { take: 1, orderBy: { order: "asc" } },
        },
      });
    }

    // Fetch test drives belonging to THIS lead (not all customer TDs — those are in customer details)
    const testDrives = await prisma.testDrive.findMany({
      where: { leadId: lead.id },
      include: {
        vehicle: {
          select: { id: true, title: true, make: { select: { name: true } }, model: { select: { name: true } } },
        },
      },
      orderBy: { scheduledAt: "desc" },
    });

    // Fetch showroom appointments belonging to THIS lead
    const showroomAppointments = await prisma.showroomAppointment.findMany({
      where: { leadId: lead.id },
      orderBy: { scheduledAt: "desc" },
    });

    return NextResponse.json({ success: true, data: { ...lead, additionalVehicles, testDrives, showroomAppointments } });
  } catch (error: unknown) {
    console.error("Lead fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

// PATCH - update lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, assignedToId, notes, priority, pipelineStageId, lostReason, vehicleId, additionalVehicleIds, adminNotes, followUpAt, followUpNote } = body;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update lead status
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (assignedToId !== undefined)
      updateData.assignedToId = assignedToId || null;
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority;
    if (lostReason !== undefined) updateData.lostReason = lostReason;
    if (vehicleId !== undefined) updateData.vehicleId = vehicleId || null;
    if (additionalVehicleIds !== undefined) updateData.additionalVehicleIds = additionalVehicleIds;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (followUpAt !== undefined) updateData.followUpAt = followUpAt ? new Date(followUpAt) : null;
    if (followUpNote !== undefined) updateData.followUpNote = followUpNote;

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    // If pipelineStageId is provided, create or move a deal
    console.log("[PATCH Lead]", id, "body:", JSON.stringify(body), "pipelineStageId:", pipelineStageId);
    if (pipelineStageId) {
      const newStage = await prisma.pipelineStage.findUnique({
        where: { id: pipelineStageId },
        select: { name: true },
      });

      const existingDeal = await prisma.deal.findFirst({
        where: { leadId: id },
        include: { stage: { select: { name: true } } },
      });

      if (existingDeal) {
        const oldStageName = existingDeal.stage.name;
        // Move deal to new stage
        await prisma.deal.update({
          where: { id: existingDeal.id },
          data: { stageId: pipelineStageId },
        });

        // Log stage change as activity
        await prisma.activity
          .create({
            data: {
              type: "STAGE_CHANGE",
              content: `Mutat din "${oldStageName}" în "${newStage?.name || "?"}"`,
              leadId: id,
              dealId: existingDeal.id,
              userId: session.user.id || null,
            },
          })
          .catch((err: unknown) => {
            console.error("[STAGE_CHANGE] Failed to create activity:", err);
          });
      } else {
        // Create new deal in this stage
        const vehicle = lead.vehicleId
          ? await prisma.vehicle.findUnique({
              where: { id: lead.vehicleId },
              select: { price: true, discountPrice: true },
            })
          : null;

        const deal = await prisma.deal.create({
          data: {
            leadId: id,
            stageId: pipelineStageId,
            value: vehicle?.discountPrice ?? vehicle?.price ?? null,
            currency: "EUR",
            probability: 10,
            brand: lead.brand,
            assignedToId: lead.assignedToId,
          },
        });

        // Log initial stage assignment as activity
        await prisma.activity
          .create({
            data: {
              type: "STAGE_CHANGE",
              content: `Adăugat în pipeline: "${newStage?.name || "?"}"`,
              leadId: id,
              dealId: deal.id,
              userId: session.user.id || null,
            },
          })
          .catch(() => {});
      }
    }

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          action: "LEAD_UPDATED",
          entity: "Lead",
          entityId: id,
          userId: session.user.id || null,
          details: `Lead actualizat: ${JSON.stringify(body)}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error: unknown) {
    console.error("Lead update error:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

// POST - add comment/activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { content, type } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const activity = await prisma.activity.create({
      data: {
        type: type || "NOTE",
        content: content.trim(),
        leadId: id,
        userId: session.user.id || null,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ success: true, data: activity });
  } catch (error: unknown) {
    console.error("Activity create error:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}

// DELETE - delete lead and associated deals/activities
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.activity.deleteMany({ where: { leadId: id } });
    await prisma.deal.deleteMany({ where: { leadId: id } });
    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Lead delete error:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
