import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  brands: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Token lipsă" });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: "Server configuration error" });
      return;
    }

    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Token invalid" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Neautorizat" });
      return;
    }

    if (req.user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({ success: false, error: "Permisiune insuficientă" });
      return;
    }

    next();
  };
}

export function requireBrand(brand: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Neautorizat" });
      return;
    }

    if (req.user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    if (!req.user.brands.includes(brand) && !req.user.brands.includes("ALL")) {
      res.status(403).json({ success: false, error: "Acces restricționat pentru acest brand" });
      return;
    }

    next();
  };
}
