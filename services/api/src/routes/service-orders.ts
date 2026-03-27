import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /pipeline - Service orders grouped by status (kanban)
router.get("/pipeline", async (req: Request, res: Response) => {
  try {
    const { brand } = req.query;

    const where: Prisma.ServiceOrderWhereInput = {};
    if (brand) where.brand = brand as any;

    const serviceOrders = await prisma.serviceOrder.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    });

    // Group by status
    const statuses = [
      "SCHEDULED", "RECEIVED", "IN_PROGRESS",
      "WAITING_PARTS", "COMPLETED", "DELIVERED", "CANCELLED",
    ];

    const pipeline = statuses.map((status) => ({
      status,
      orders: serviceOrders.filter((so) => so.status === status),
      count: serviceOrders.filter((so) => so.status === status).length,
    }));

    res.json({ success: true, data: pipeline });
  } catch (error) {
    console.error("Get service pipeline error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea pipeline-ului service" });
  }
});

// GET / - List service orders with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      status,
      assignedTo,
      brand,
      type,
      scheduledFrom,
      scheduledTo,
      search,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.ServiceOrderWhereInput = {};

    if (status) where.status = status as any;
    if (assignedTo) where.assignedToId = String(assignedTo);
    if (brand) where.brand = brand as any;
    if (type) where.type = String(type);

    if (scheduledFrom || scheduledTo) {
      where.scheduledDate = {};
      if (scheduledFrom) where.scheduledDate.gte = new Date(String(scheduledFrom));
      if (scheduledTo) where.scheduledDate.lte = new Date(String(scheduledTo));
    }

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { orderNumber: { contains: searchStr, mode: "insensitive" } },
        { description: { contains: searchStr, mode: "insensitive" } },
        { customer: { firstName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { lastName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { phone: { contains: searchStr, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          vehicle: {
            include: {
              make: { select: { name: true } },
              model: { select: { name: true } },
            },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List service orders error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea comenzilor service" });
  }
});

// GET /:id - Single service order
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        vehicle: {
          include: {
            make: true,
            model: true,
            images: { orderBy: { order: "asc" }, take: 1 },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: "Comanda service nu a fost găsită" });
      return;
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("Get service order error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea comenzii service" });
  }
});

// POST / - Create service order
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      customerId, vehicleId, type, description,
      assignedToId, scheduledDate, estimatedCost,
      currency, brand, notes,
    } = req.body;

    if (!customerId) {
      res.status(400).json({
        success: false,
        error: "customerId este obligatoriu",
      });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    const order = await prisma.serviceOrder.create({
      data: {
        customerId,
        vehicleId: vehicleId || null,
        type: type || null,
        description: description || null,
        assignedToId: assignedToId || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedCost: estimatedCost ? Number(estimatedCost) : null,
        currency: currency || "EUR",
        brand: brand || "SERVICE",
        notes: notes || null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ServiceOrder",
        entityId: order.id,
        userId: req.user!.id,
        details: { orderNumber: order.orderNumber, type: order.type },
      },
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error("Create service order error:", error);
    res.status(500).json({ success: false, error: "Eroare la crearea comenzii service" });
  }
});

// PATCH /:id - Update service order, change status
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.serviceOrder.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Comanda service nu a fost găsită" });
      return;
    }

    const {
      status, type, description, assignedToId,
      scheduledDate, receivedDate, completedDate, deliveredDate,
      estimatedCost, actualCost, currency, notes,
    } = req.body;

    const data: Prisma.ServiceOrderUpdateInput = {};

    if (status !== undefined) data.status = status;
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description || null;
    if (assignedToId !== undefined) data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (scheduledDate !== undefined) data.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (receivedDate !== undefined) data.receivedDate = receivedDate ? new Date(receivedDate) : null;
    if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null;
    if (deliveredDate !== undefined) data.deliveredDate = deliveredDate ? new Date(deliveredDate) : null;
    if (estimatedCost !== undefined) data.estimatedCost = estimatedCost ? Number(estimatedCost) : null;
    if (actualCost !== undefined) data.actualCost = actualCost ? Number(actualCost) : null;
    if (currency !== undefined) data.currency = currency;
    if (notes !== undefined) data.notes = notes || null;

    // Auto-set date fields based on status changes
    if (status === "RECEIVED" && !existing.receivedDate && receivedDate === undefined) {
      data.receivedDate = new Date();
    }
    if (status === "COMPLETED" && !existing.completedDate && completedDate === undefined) {
      data.completedDate = new Date();
    }
    if (status === "DELIVERED" && !existing.deliveredDate && deliveredDate === undefined) {
      data.deliveredDate = new Date();
    }

    const order = await prisma.serviceOrder.update({
      where: { id: req.params.id },
      data,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "ServiceOrder",
        entityId: order.id,
        userId: req.user!.id,
        details: {
          updatedFields: Object.keys(req.body),
          statusChange: status && status !== existing.status
            ? { from: existing.status, to: status }
            : undefined,
        },
      },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("Update service order error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea comenzii service" });
  }
});

export { router as serviceRoutes };
