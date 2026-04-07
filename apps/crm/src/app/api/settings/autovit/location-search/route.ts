import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Proxy for Autovit location search (regions / cities / districts).
// Requires Autovit API credentials.

const BASE_URL = "https://www.autovit.ro/api/open";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }
  const clientId = process.env.AUTOVIT_CLIENT_ID;
  const clientSecret = process.env.AUTOVIT_CLIENT_SECRET;
  const username = process.env.AUTOVIT_USERNAME;
  const password = process.env.AUTOVIT_PASSWORD;
  if (!clientId || !clientSecret || !username || !password) return null;

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "password",
      username,
      password,
    }).toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function autovitFetch(path: string): Promise<unknown> {
  const token = await getToken();
  if (!token) throw new Error("Autovit API not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.AUTOVIT_USERNAME || "crm@autoerebus.ro",
    },
  });
  if (!res.ok) throw new Error(`Autovit API error ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "regions" | "cities" | "districts"
  const q = searchParams.get("q") || "";
  const regionId = searchParams.get("regionId");
  const cityId = searchParams.get("cityId");

  try {
    if (type === "regions") {
      const data: any = await autovitFetch("/regions");
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.names?.ro || r.name || "",
      }));
      // Filter client-side if query provided
      const filtered = q
        ? results.filter((r: any) => r.name.toLowerCase().includes(q.toLowerCase()))
        : results;
      return NextResponse.json({ results: filtered });
    }

    if (type === "cities") {
      if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
      }
      const data: any = await autovitFetch(`/cities?search=${encodeURIComponent(q)}`);
      const results = (data.results || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.text || "",
        text: c.text || c.name || "",
        regionId: c.region_id,
        districtsCityId: c.districts_city_id,
      }));
      return NextResponse.json({ results: results.slice(0, 20) });
    }

    if (type === "districts") {
      if (!cityId) return NextResponse.json({ results: [] });
      const data: any = await autovitFetch(`/districts/for-city-id/${cityId}`);
      const results = (data.results || data || []).map((d: any) => ({
        id: d.id,
        name: d.name || d.names?.ro || "",
      }));
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare" },
      { status: 500 }
    );
  }
}
