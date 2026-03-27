import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/inventory") ||
        nextUrl.pathname.startsWith("/sales") ||
        nextUrl.pathname.startsWith("/service") ||
        nextUrl.pathname.startsWith("/claims") ||
        nextUrl.pathname.startsWith("/test-drives") ||
        nextUrl.pathname.startsWith("/customers") ||
        nextUrl.pathname.startsWith("/users") ||
        nextUrl.pathname.startsWith("/settings");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.brands = user.brands;
        token.permissions = user.permissions;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.brands = token.brands as string[];
        session.user.permissions = token.permissions as string[];
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
      }
      return session;
    },
  },
  providers: [],
};
