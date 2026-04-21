import { Router, Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();

/**
 * GET /api/cloudinary/signature?folder=autoerebus/offers
 *
 * Returns a signed upload URL for client-side Cloudinary direct upload.
 * JWT-protected (authMiddleware).
 */
router.get("/signature", async (req: Request, res: Response) => {
  try {
    const folder = String(req.query.folder || "autoerebus/offers");
    const timestamp = Math.round(new Date().getTime() / 1000);

    const params: Record<string, string | number> = {
      timestamp,
      folder,
      transformation: "c_limit,w_1920,h_1440,q_auto,f_auto",
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!
    );

    res.json({
      success: true,
      data: {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder,
        transformation: params.transformation,
      },
    });
  } catch (error) {
    console.error("Cloudinary signature error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la generarea semnăturii" });
  }
});

/**
 * DELETE /api/cloudinary/:publicId
 * Delete an uploaded Cloudinary asset.
 * JWT-protected.
 */
router.delete("/:publicId(*)", async (req: Request, res: Response) => {
  try {
    const publicId = String(req.params.publicId || "");
    if (!publicId) {
      res
        .status(400)
        .json({ success: false, error: "publicId este obligatoriu" });
      return;
    }
    const result = await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    res
      .status(500)
      .json({ success: false, error: "Eroare la ștergerea imaginii" });
  }
});

export { router as cloudinaryRoutes };
