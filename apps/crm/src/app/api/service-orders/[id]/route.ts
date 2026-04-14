import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - full service order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.serviceOrder.findUnique({
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
        activities: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Comanda nu a fost gasita" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error: unknown) {
    console.error("Service order fetch error:", error);
    return NextResponse.json({ error: "Eroare la citire" }, { status: 500 });
  }
}

// PATCH - update service order (status change, fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Comanda nu a fost gasita" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Status change
    if (body.status && body.status !== order.status) {
      const oldStatus = order.status;
      updateData.status = body.status;

      // Auto-set date fields based on status
      if (body.status === "RECEIVED" && !order.receivedDate) {
        updateData.receivedDate = new Date();
      }
      if (body.status === "COMPLETED" && !order.completedDate) {
        updateData.completedDate = new Date();
      }
      if (body.status === "DELIVERED" && !order.deliveredDate) {
        updateData.deliveredDate = new Date();
      }

      // Log stage change
      const STATUS_LABELS: Record<string, string> = {
        SCHEDULED: "Programat",
        RECEIVED: "Recepționat",
        IN_PROGRESS: "În Lucru",
        WAITING_PARTS: "Așteptare Piese",
        COMPLETED: "Finalizat",
        DELIVERED: "Livrat",
        CANCELLED: "Anulat",
      };
      await prisma.activity.create({
        data: {
          type: "STAGE_CHANGE",
          content: body.comment
            ? `Mutat din "${STATUS_LABELS[oldStatus] || oldStatus}" în "${STATUS_LABELS[body.status] || body.status}" — ${body.comment}`
            : `Mutat din "${STATUS_LABELS[oldStatus] || oldStatus}" în "${STATUS_LABELS[body.status] || body.status}"`,
          serviceOrderId: id,
          userId: session.user.id || null,
        },
      }).catch(() => {});
    }

    // Other fields
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.scheduledDate !== undefined) updateData.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
    if (body.receivedDate !== undefined) updateData.receivedDate = body.receivedDate ? new Date(body.receivedDate) : null;
    if (body.completedDate !== undefined) updateData.completedDate = body.completedDate ? new Date(body.completedDate) : null;
    if (body.deliveredDate !== undefined) updateData.deliveredDate = body.deliveredDate ? new Date(body.deliveredDate) : null;
    if (body.estimatedCost !== undefined) updateData.estimatedCost = body.estimatedCost ? parseFloat(body.estimatedCost) : null;
    if (body.actualCost !== undefined) updateData.actualCost = body.actualCost ? parseFloat(body.actualCost) : null;
    if (body.vehicleId !== undefined) updateData.vehicleId = body.vehicleId || null;
    if (body.cancelReason) {
      updateData.notes = (order.notes ? order.notes + "\n" : "") + `Motiv anulare: ${body.cancelReason}`;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("Service order update error:", error);
    return NextResponse.json({ error: "Eroare la actualizare" }, { status: 500 });
  }
}

// POST - add activity/comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { content, type } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Conținutul este obligatoriu" }, { status: 400 });
  }

  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Comanda nu a fost gasita" }, { status: 404 });
    }

    const activity = await prisma.activity.create({
      data: {
        type: type || "NOTE",
        content: content.trim(),
        serviceOrderId: id,
        userId: session.user.id || null,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ success: true, data: activity });
  } catch (error: unknown) {
    console.error("Activity create error:", error);
    return NextResponse.json({ error: "Eroare la adaugare comentariu" }, { status: 500 });
  }
}

// DELETE - delete service order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.activity.deleteMany({ where: { serviceOrderId: id } });
    await prisma.serviceOrder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Service order delete error:", error);
    return NextResponse.json({ error: "Eroare la stergere" }, { status: 500 });
  }
}
