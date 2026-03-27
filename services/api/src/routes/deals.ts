import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /pipeline/:brand - Get deals grouped by pipeline stage (kanban)
// Must be before /:id to avoid route conflict
router.get("/pipeline/:brand", async (req: Request, res: Response) => {
  try {
    const { brand } = req.params;

    const stages = await prisma.pipelineStage.findMany({
      where: {
        pipelineType: "SALES",
        OR: [{ brand: brand as any }, { brand: null }],
      },
      include: {
        deals: {
          where: { brand: brand as any },
          include: {
            lead: {
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
              },
            },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { order: "asc" },
    });

    res.json({ success: true, data: stages });
  } catch (error) {
    console.error("Get pipeline error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea pipeline-ului" });
  }
});

// GET / - List deals with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      brand,
      stageId,
      assignedTo,
      search,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.DealWhereInput = {};

    if (brand) where.brand = brand as any;
    if (stageId) where.stageId = String(stageId);
    if (assignedTo) where.assignedToId = String(assignedTo);

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { lead: { customer: { firstName: { contains: searchStr, mode: "insensitive" } } } },
        { lead: { customer: { lastName: { contains: searchStr, mode: "insensitive" } } } },
        { notes: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          lead: {
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
            },
          },
          stage: { select: { id: true, name: true, color: true, order: true } },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { activities: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
      prisma.deal.count({ where }),
    ]);

    res.json({
      success: true,
      data: deals,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List deals error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea deal-urilor" });
  }
});

// GET /:id - Single deal with relations
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        lead: {
          include: {
            customer: true,
            vehicle: {
              include: {
                make: true,
                model: true,
                images: { orderBy: { order: "asc" }, take: 3 },
              },
            },
          },
        },
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        activities: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!deal) {
      res.status(404).json({ success: false, error: "Deal-ul nu a fost găsit" });
      return;
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    console.error("Get deal error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea deal-ului" });
  }
});

// POST / - Create deal from lead
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      leadId, stageId, value, currency,
      probability, expectedCloseDate, brand,
      assignedToId, notes,
    } = req.body;

    if (!leadId || !brand) {
      res.status(400).json({
        success: false,
        error: "leadId și brand sunt obligatorii",
      });
      return;
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      res.status(404).json({ success: false, error: "Lead-ul nu a fost găsit" });
      return;
    }

    // Get default stage if not provided
    let resolvedStageId = stageId;
    if (!resolvedStageId) {
      const defaultStage = await prisma.pipelineStage.findFirst({
        where: {
          pipelineType: "SALES",
          isDefault: true,
          OR: [{ brand: brand as any }, { brand: null }],
        },
        orderBy: { order: "asc" },
      });

      if (!defaultStage) {
        // Fallback: get first stage
        const firstStage = await prisma.pipelineStage.findFirst({
          where: {
            pipelineType: "SALES",
            OR: [{ brand: brand as any }, { brand: null }],
          },
          orderBy: { order: "asc" },
        });
        resolvedStageId = firstStage?.id;
      } else {
        resolvedStageId = defaultStage.id;
      }
    }

    if (!resolvedStageId) {
      res.status(400).json({
        success: false,
        error: "Nu există un stage de pipeline configurat. Creați stagii mai întâi.",
      });
      return;
    }

    const deal = await prisma.deal.create({
      data: {
        leadId,
        stageId: resolvedStageId,
        value: value ? Number(value) : null,
        currency: currency || "EUR",
        probability: probability ?? 0,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        brand,
        assignedToId: assignedToId || lead.assignedToId || req.user!.id,
        notes: notes || null,
      },
      include: {
        lead: {
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Update lead status to NEGOTIATION if still in earlier stages
    if (["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status)) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "NEGOTIATION" },
      });
    }

    // Create activity
    await prisma.activity.create({
      data: {
        type: "NOTE",
        content: "Deal creat",
        leadId,
        dealId: deal.id,
        userId: req.user!.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Deal",
        entityId: deal.id,
        userId: req.user!.id,
        details: { brand: deal.brand, value: deal.value },
      },
    });

    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    console.error("Create deal error:", error);
    res.status(500).json({ success: false, error: "Eroare la crearea deal-ului" });
  }
});

// PATCH /:id - Update deal, move stages
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: { stage: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: "Deal-ul nu a fost găsit" });
      return;
    }

    const {
      stageId, value, currency, probability,
      expectedCloseDate, actualCloseDate,
      assignedToId, notes,
    } = req.body;

    const data: Prisma.DealUpdateInput = {};

    if (stageId !== undefined) data.stage = { connect: { id: stageId } };
    if (value !== undefined) data.value = value ? Number(value) : null;
    if (currency !== undefined) data.currency = currency;
    if (probability !== undefined) data.probability = Number(probability);
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    if (actualCloseDate !== undefined) data.actualCloseDate = actualCloseDate ? new Date(actualCloseDate) : null;
    if (assignedToId !== undefined) data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (notes !== undefined) data.notes = notes || null;

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data,
      include: {
        lead: {
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        stage: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Log stage change as activity
    if (stageId && stageId !== existing.stageId) {
      const newStage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
      await prisma.activity.create({
        data: {
          type: "NOTE",
          content: `Deal mutat de la "${existing.stage.name}" la "${newStage?.name || stageId}"`,
          leadId: deal.leadId,
          dealId: deal.id,
          userId: req.user!.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Deal",
        entityId: deal.id,
        userId: req.user!.id,
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: deal });
  } catch (error) {
    console.error("Update deal error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea deal-ului" });
  }
});

export { router as dealRoutes };
