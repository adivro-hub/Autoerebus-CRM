import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET / - List leads with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      brand,
      status,
      assignedTo,
      source,
      priority,
      search,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.LeadWhereInput = {};

    if (brand) where.brand = brand as any;
    if (status) where.status = status as any;
    if (assignedTo) where.assignedToId = String(assignedTo);
    if (source) where.source = source as any;
    if (priority) where.priority = Number(priority);

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { customer: { firstName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { lastName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { email: { contains: searchStr, mode: "insensitive" } } },
        { customer: { phone: { contains: searchStr, mode: "insensitive" } } },
        { notes: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          vehicle: {
            select: { id: true, brand: true, year: true, price: true },
            include: {
              make: { select: { name: true } },
              model: { select: { name: true } },
            } as any,
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { activities: true, deals: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List leads error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea lead-urilor" });
  }
});

// GET /:id - Single lead with relations
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({
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
        activities: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        deals: {
          include: {
            stage: { select: { name: true, color: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      res.status(404).json({ success: false, error: "Lead-ul nu a fost găsit" });
      return;
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error("Get lead error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea lead-ului" });
  }
});

// POST / - Create lead
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      customerId, vehicleId, source, brand,
      status, assignedToId, priority, notes,
    } = req.body;

    if (!customerId || !brand) {
      res.status(400).json({
        success: false,
        error: "customerId și brand sunt obligatorii",
      });
      return;
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        customerId,
        vehicleId: vehicleId || null,
        source: source || "OTHER",
        brand,
        status: status || "NEW",
        assignedToId: assignedToId || req.user!.id,
        priority: priority ?? 0,
        notes: notes || null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
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

    // Create initial activity
    await prisma.activity.create({
      data: {
        type: "NOTE",
        content: "Lead creat",
        leadId: lead.id,
        userId: req.user!.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Lead",
        entityId: lead.id,
        userId: req.user!.id,
        details: { brand: lead.brand, source: lead.source },
      },
    });

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ success: false, error: "Eroare la crearea lead-ului" });
  }
});

// PATCH /:id - Update lead
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Lead-ul nu a fost găsit" });
      return;
    }

    const {
      vehicleId, source, brand, status,
      assignedToId, priority, notes, lostReason,
    } = req.body;

    const data: Prisma.LeadUpdateInput = {};

    if (vehicleId !== undefined) data.vehicle = vehicleId ? { connect: { id: vehicleId } } : { disconnect: true };
    if (source !== undefined) data.source = source;
    if (brand !== undefined) data.brand = brand;
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (priority !== undefined) data.priority = Number(priority);
    if (notes !== undefined) data.notes = notes || null;
    if (lostReason !== undefined) data.lostReason = lostReason || null;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Log status change as activity
    if (status && status !== existing.status) {
      await prisma.activity.create({
        data: {
          type: "NOTE",
          content: `Status schimbat de la ${existing.status} la ${status}`,
          leadId: lead.id,
          userId: req.user!.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Lead",
        entityId: lead.id,
        userId: req.user!.id,
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea lead-ului" });
  }
});

// POST /:id/activities - Add activity to lead
router.post("/:id/activities", async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ success: false, error: "Lead-ul nu a fost găsit" });
      return;
    }

    const { type, content, metadata } = req.body;

    if (!type || !content) {
      res.status(400).json({
        success: false,
        error: "Tipul și conținutul sunt obligatorii",
      });
      return;
    }

    const activity = await prisma.activity.create({
      data: {
        type,
        content,
        leadId: req.params.id,
        userId: req.user!.id,
        metadata: metadata || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    console.error("Create activity error:", error);
    res.status(500).json({ success: false, error: "Eroare la adăugarea activității" });
  }
});

export { router as leadRoutes };
