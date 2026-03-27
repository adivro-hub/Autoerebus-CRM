import NextAuth, { type NextAuthResult } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@autoerebus/database";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie sa aiba minim 6 caractere"),
});

const nextAuth: NextAuthResult = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Parola", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.active) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          image: user.avatar,
          role: user.role,
          brands: user.brands,
          permissions: user.permissions,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;

// Extend next-auth types
declare module "next-auth" {
  interface User {
    role?: string;
    brands?: string[];
    permissions?: string[];
    firstName?: string;
    lastName?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: string;
      brands: string[];
      permissions: string[];
      firstName: string;
      lastName: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    brands?: string[];
    permissions?: string[];
    firstName?: string;
    lastName?: string;
  }
}
