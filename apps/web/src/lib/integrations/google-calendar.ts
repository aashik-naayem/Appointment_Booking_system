/**
 * Google Calendar Integration
 *
 * Handles OAuth connection and event synchronization.
 * All OAuth tokens are stored encrypted.
 */

import { google } from "googleapis";
import { prisma } from "@bookflow/database";
import { encrypt, decrypt } from "@/lib/utils/crypto";

const oauth2Client = new google.auth.OAuth2(
  process.env["GOOGLE_CALENDAR_CLIENT_ID"],
  process.env["GOOGLE_CALENDAR_CLIENT_SECRET"],
  process.env["GOOGLE_CALENDAR_REDIRECT_URI"],
);

// ============================================================
// OAUTH FLOW
// ============================================================

export function getGoogleCalendarAuthUrl(staffId: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: staffId,
    prompt: "consent", // Force consent to get refresh token
  });
}

export async function exchangeGoogleCalendarCode(staffId: string, code: string): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("No access token received from Google");
  }

  // Get calendar info
  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarList = await calendar.calendarList.get({ calendarId: "primary" });

  // Store encrypted tokens
  await prisma.calendarConnection.upsert({
    where: { staffId_provider: { staffId, provider: "google" } },
    create: {
      staffId,
      provider: "google",
      calendarId: calendarList.data.id ?? "primary",
      calendarName: calendarList.data.summary ?? "Google Calendar",
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      isActive: true,
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      isActive: true,
    },
  });
}

export async function disconnectGoogleCalendar(staffId: string): Promise<void> {
  await prisma.calendarConnection.updateMany({
    where: { staffId, provider: "google" },
    data: { isActive: false },
  });
}

// ============================================================
// CALENDAR OPERATIONS
// ============================================================

export async function syncCalendarEvent(
  appointmentId: string,
  action: "create" | "update" | "delete",
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: true,
      customer: true,
      tenant: true,
      staff: {
        include: {
          calendarConnections: {
            where: { provider: "google", isActive: true },
          },
        },
      },
    },
  });

  if (!appointment?.staff) return;

  const connection = appointment.staff.calendarConnections[0];
  if (!connection) return;

  try {
    const client = await getAuthenticatedClient(connection);
    const calendar = google.calendar({ version: "v3", auth: client });

    switch (action) {
      case "create": {
        const event = await calendar.events.insert({
          calendarId: connection.calendarId ?? "primary",
          requestBody: buildCalendarEvent(appointment),
        });

        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { calendarEventId: event.data.id },
        });
        break;
      }

      case "update": {
        if (!appointment.calendarEventId) {
          await syncCalendarEvent(appointmentId, "create");
          return;
        }

        await calendar.events.update({
          calendarId: connection.calendarId ?? "primary",
          eventId: appointment.calendarEventId,
          requestBody: buildCalendarEvent(appointment),
        });
        break;
      }

      case "delete": {
        if (!appointment.calendarEventId) return;

        await calendar.events.delete({
          calendarId: connection.calendarId ?? "primary",
          eventId: appointment.calendarEventId,
        });

        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { calendarEventId: null },
        });
        break;
      }
    }
  } catch (error) {
    console.error(`Calendar sync error (${action}):`, error);
    // Don't throw — calendar sync failure should not break booking flow
  }
}

// ============================================================
// HELPERS
// ============================================================

async function getAuthenticatedClient(connection: {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  id: string;
}) {
  oauth2Client.setCredentials({
    access_token: decrypt(connection.accessToken),
    refresh_token: connection.refreshToken ? decrypt(connection.refreshToken) : undefined,
    expiry_date: connection.tokenExpiry?.getTime(),
  });

  // Auto-refresh if token is expired
  if (connection.tokenExpiry && connection.tokenExpiry < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update stored tokens
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encrypt(credentials.access_token!),
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });

    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

function buildCalendarEvent(appointment: {
  startTime: Date;
  endTime: Date;
  timezone: string;
  service: { name: string; duration: number };
  customer: { name: string; email: string };
  tenant: { name: string };
  staff: { name: string } | null;
  customerNotes: string | null;
}): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: { email: string; displayName: string }[];
} {
  return {
    summary: `${appointment.service.name} - ${appointment.customer.name}`,
    description: [
      `Customer: ${appointment.customer.name}`,
      `Service: ${appointment.service.name} (${appointment.service.duration} min)`,
      appointment.customerNotes ? `Notes: ${appointment.customerNotes}` : "",
      `Business: ${appointment.tenant.name}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: appointment.timezone,
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: appointment.timezone,
    },
    attendees: [{ email: appointment.customer.email, displayName: appointment.customer.name }],
  };
}
