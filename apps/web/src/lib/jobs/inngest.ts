import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "bookflow",
  name: "BookFlow",
  eventKey: process.env["INNGEST_EVENT_KEY"],
});

// ============================================================
// EVENT TYPE DEFINITIONS
// ============================================================

export type BookingCreatedEvent = {
  name: "booking/created";
  data: { appointmentId: string; tenantId: string };
};

export type BookingCancelledEvent = {
  name: "booking/cancelled";
  data: { appointmentId: string; tenantId: string };
};

export type BookingRescheduledEvent = {
  name: "booking/rescheduled";
  data: { appointmentId: string; oldAppointmentId: string; tenantId: string };
};

export type BookingCompletedEvent = {
  name: "booking/completed";
  data: { appointmentId: string; tenantId: string };
};

export type SendNotificationEvent = {
  name: "notification/send";
  data: { notificationId: string };
};

export type SendPendingRemindersEvent = {
  name: "notification/send-pending-reminders";
  data: Record<string, never>;
};

export type CalendarSyncEvent = {
  name: "calendar/sync";
  data: { appointmentId: string; action: "create" | "update" | "delete" };
};

export type StripeWebhookEvent = {
  name: "stripe/webhook";
  data: { eventId: string; type: string; payload: Record<string, unknown> };
};

export type Events =
  | BookingCreatedEvent
  | BookingCancelledEvent
  | BookingRescheduledEvent
  | BookingCompletedEvent
  | SendNotificationEvent
  | SendPendingRemindersEvent
  | CalendarSyncEvent
  | StripeWebhookEvent;
