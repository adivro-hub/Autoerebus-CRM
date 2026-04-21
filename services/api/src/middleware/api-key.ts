import { Request, Response, NextFunction } from "express";

/**
 * Validates the x-api-key header for public "external" endpoints
 * that don't require user authentication (e.g. website form submissions,
 * public offer listings).
 *
 * Set EXTERNAL_API_KEY in env. Rotate periodically.
 */
export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const key = req.headers["x-api-key"];
  const expected = process.env.EXTERNAL_API_KEY;

  if (!expected) {
    console.error("[apiKeyMiddleware] EXTERNAL_API_KEY not configured");
    return res
      .status(503)
      .json({ success: false, error: "API key not configured" });
  }

  if (!key || key !== expected) {
    return res.status(401).json({ success: false, error: "API key invalid" });
  }

  next();
};
