import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@autoerebus/database";

const router = Router();

// POST /login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email și parola sunt obligatorii" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.active) {
      res.status(401).json({ success: false, error: "Credențiale invalide" });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: "Credențiale invalide" });
      return;
    }

    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: "Server configuration error" });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        brands: user.brands,
        permissions: user.permissions,
      },
      secret,
      { expiresIn: "8h" }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        userId: user.id,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          brands: user.brands,
          permissions: user.permissions,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Eroare la autentificare" });
  }
});

// POST /register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, role, brands } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: "Email, parola, prenumele și numele sunt obligatorii",
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Parola trebuie să aibă minim 8 caractere" });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ success: false, error: "Email-ul este deja înregistrat" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        role: role || "AGENT",
        brands: brands || [],
        permissions: [],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        brands: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        userId: user.id,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, error: "Eroare la înregistrare" });
  }
});

export { router as authRoutes };
