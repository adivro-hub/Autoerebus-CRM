import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/service-offers/revalidate
 *
 * Tells the public Autoerebus service site to purge its offers cache
 * immediately so new offers show up without waiting for the 5-min TTL.
 *
 * Requires the admin to be logged in. Forwards the shared secret
 * to the site's /api/revalidate endpoint.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const siteUrl = process.env.SERVICE_SITE_URL;
  const secret = process.env.SERVICE_SITE_REVALIDATE_SECRET;

  if (!siteUrl || !secret) {
    return NextResponse.json(
      {
        error: "SERVICE_SITE_URL or SERVICE_SITE_REVALIDATE_SECRET not configured",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tag: "offers" }),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[service-offers/revalidate]", res.status, data);
      return NextResponse.json(
        { error: data?.error || "Revalidare eșuată" },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[service-offers/revalidate] error:", error);
    return NextResponse.json(
      { error: "Eroare de conexiune cu site-ul" },
      { status: 502 }
    );
  }
}
