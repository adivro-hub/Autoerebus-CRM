import { prisma } from "@autoerebus/database";

const GOOGLE_OAUTH_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: { email: string; displayName?: string }[];
  location?: string;
}

/**
 * Exchange a refresh token for an access token.
 */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[GoogleCalendar] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return null;
  }

  try {
    const res = await fetch(GOOGLE_OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    if (!res.ok) {
      console.error("[GoogleCalendar] Token refresh failed:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.access_token;
  } catch (e) {
    console.error("[GoogleCalendar] Token error:", e);
    return null;
  }
}

/**
 * Exchange an authorization code for tokens (initial OAuth).
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials");
  }

  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Get user info from Google (email, etc).
 */
export async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json() as Promise<{ email: string; name: string }>;
}

/**
 * Create a calendar event in the user's calendar.
 */
export async function createGoogleEvent(userId: string, input: GoogleEventInput): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });

  if (!user?.googleRefreshToken) return null;

  const accessToken = await getAccessToken(user.googleRefreshToken);
  if (!accessToken) return null;

  const calendarId = user.googleCalendarId || "primary";
  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start.toISOString(), timeZone: "Europe/Bucharest" },
          end: { dateTime: input.end.toISOString(), timeZone: "Europe/Bucharest" },
          attendees: input.attendees,
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "email", minutes: 60 },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("[GoogleCalendar] Create failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.id as string;
  } catch (e) {
    console.error("[GoogleCalendar] Create error:", e);
    return null;
  }
}

/**
 * Update a calendar event.
 */
export async function updateGoogleEvent(
  userId: string,
  eventId: string,
  input: Partial<GoogleEventInput>
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });

  if (!user?.googleRefreshToken) return false;

  const accessToken = await getAccessToken(user.googleRefreshToken);
  if (!accessToken) return false;

  const calendarId = user.googleCalendarId || "primary";
  try {
    const body: any = {};
    if (input.summary) body.summary = input.summary;
    if (input.description) body.description = input.description;
    if (input.location) body.location = input.location;
    if (input.start) body.start = { dateTime: input.start.toISOString(), timeZone: "Europe/Bucharest" };
    if (input.end) body.end = { dateTime: input.end.toISOString(), timeZone: "Europe/Bucharest" };

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    return res.ok;
  } catch (e) {
    console.error("[GoogleCalendar] Update error:", e);
    return false;
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteGoogleEvent(userId: string, eventId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });

  if (!user?.googleRefreshToken) return false;

  const accessToken = await getAccessToken(user.googleRefreshToken);
  if (!accessToken) return false;

  const calendarId = user.googleCalendarId || "primary";
  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return res.ok || res.status === 410; // 410 = already gone
  } catch (e) {
    console.error("[GoogleCalendar] Delete error:", e);
    return false;
  }
}
