import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { exchangeCodeForTokens, getGoogleUserInfo } from "@/lib/google-calendar";

/**
 * GET /api/google/callback?code=...&state=...
 * Callback from Google OAuth. Exchanges code for tokens and saves them.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?google_error=${error}`, request.url));
  }

  if (!code || state !== session.user.id) {
    return NextResponse.redirect(new URL("/settings?google_error=invalid_state", request.url));
  }

  try {
    const redirectUri = `${new URL(request.url).origin}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/settings?google_error=no_refresh_token", request.url)
      );
    }

    const userInfo = await getGoogleUserInfo(tokens.access_token);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleCalendarId: "primary",
        googleEmail: userInfo.email,
      },
    });

    return NextResponse.redirect(new URL("/settings?google_connected=1", request.url));
  } catch (err) {
    console.error("[Google callback] error:", err);
    return NextResponse.redirect(new URL("/settings?google_error=exchange_failed", request.url));
  }
}
