import NextAuth, { type NextAuthResult } from "next-auth";
import { authConfig } from "@/lib/auth.config";

const authMiddleware: NextAuthResult["auth"] = NextAuth(authConfig).auth;
export default authMiddleware;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
