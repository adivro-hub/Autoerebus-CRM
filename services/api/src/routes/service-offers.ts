import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Public (external) router ─────────────────────────────
// Used by public websites to display offers on their homepages.
// Auth via x-api-key header (apiKeyMiddleware).
export const externalRouter = Router();

externalRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { brand } = req.query;

    const where: Prisma.ServiceOfferWhereInput = { active: true };
    if (brand) where.brand = brand as any;

    const offers = await prisma.serviceOffer.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        brand: true,
        validityText: true,
        order: true,
        ctaUrl: true,
      },
    });

    res.json({ success: true, data: offers });
  } catch (error) {
    console.error("List external offers error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la listarea ofertelor" });
  }
});

// ─── Protected admin router (JWT) ────────────────────────
const router = Router();

// GET / - List offers with filters (admin)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { brand, active, search } = req.query;

    const where: Prisma.ServiceOfferWhereInput = {};
    if (brand) where.brand = brand as any;
    if (active !== undefined) where.active = active === "true";
    if (search) {
      const s = String(search);
      where.OR = [
        { title: { contains: s, mode: "insensitive" } },
        { description: { contains: s, mode: "insensitive" } },
      ];
    }

    const offers = await prisma.serviceOffer.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    res.json({ success: true, data: offers });
  } catch (error) {
    console.error("List offers error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la listarea ofertelor" });
  }
});

// GET /:id - Single offer
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const offer = await prisma.serviceOffer.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!offer) {
      res
        .status(404)
        .json({ success: false, error: "Oferta nu a fost găsită" });
      return;
    }

    res.json({ success: true, data: offer });
  } catch (error) {
    console.error("Get offer error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la obținerea ofertei" });
  }
});

// POST / - Create offer
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      imageUrl,
      imageCloudinaryId,
      brand,
      validityText,
      order,
      active,
      ctaUrl,
    } = req.body;

    if (!title || !description || !imageUrl || !brand) {
      res.status(400).json({
        success: false,
        error: "title, description, imageUrl și brand sunt obligatorii",
      });
      return;
    }

    const offer = await prisma.serviceOffer.create({
      data: {
        title,
        description,
        imageUrl,
        imageCloudinaryId: imageCloudinaryId || null,
        brand,
        validityText: validityText || null,
        order: order ?? 0,
        active: active ?? true,
        ctaUrl: ctaUrl || null,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ServiceOffer",
        entityId: offer.id,
        userId: req.user!.id,
        details: { brand: offer.brand, title: offer.title },
      },
    });

    res.status(201).json({ success: true, data: offer });
  } catch (error) {
    console.error("Create offer error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la crearea ofertei" });
  }
});

// PATCH /:id - Update offer
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.serviceOffer.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) {
      res
        .status(404)
        .json({ success: false, error: "Oferta nu a fost găsită" });
      return;
    }

    const {
      title,
      description,
      imageUrl,
      imageCloudinaryId,
      brand,
      validityText,
      order,
      active,
      ctaUrl,
    } = req.body;

    const data: Prisma.ServiceOfferUpdateInput = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (imageCloudinaryId !== undefined)
      data.imageCloudinaryId = imageCloudinaryId || null;
    if (brand !== undefined) data.brand = brand;
    if (validityText !== undefined) data.validityText = validityText || null;
    if (order !== undefined) data.order = Number(order);
    if (active !== undefined) data.active = active;
    if (ctaUrl !== undefined) data.ctaUrl = ctaUrl || null;

    // If image was replaced, delete old one from Cloudinary
    if (
      imageCloudinaryId !== undefined &&
      existing.imageCloudinaryId &&
      existing.imageCloudinaryId !== imageCloudinaryId
    ) {
      try {
        await cloudinary.uploader.destroy(existing.imageCloudinaryId);
      } catch (err) {
        console.warn("[ServiceOffer] Failed to delete old Cloudinary asset:", err);
      }
    }

    const offer = await prisma.serviceOffer.update({
      where: { id: String(req.params.id) },
      data,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "ServiceOffer",
        entityId: offer.id,
        userId: req.user!.id,
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: offer });
  } catch (error) {
    console.error("Update offer error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la actualizarea ofertei" });
  }
});

// DELETE /:id - Delete offer + Cloudinary asset
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const offer = await prisma.serviceOffer.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!offer) {
      res
        .status(404)
        .json({ success: false, error: "Oferta nu a fost găsită" });
      return;
    }

    // Delete Cloudinary asset
    if (offer.imageCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(offer.imageCloudinaryId);
      } catch (err) {
        console.warn("[ServiceOffer] Failed to delete Cloudinary asset:", err);
      }
    }

    await prisma.serviceOffer.delete({ where: { id: String(req.params.id) } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "ServiceOffer",
        entityId: offer.id,
        userId: req.user!.id,
        details: { brand: offer.brand, title: offer.title },
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete offer error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la ștergerea ofertei" });
  }
});

export { router as serviceOfferRoutes };
