/**
 * Inngest Background Job Functions
 * All jobs are idempotent and handle retries gracefully.
 */

import { inngest } from "./inngest";
import { prisma, NotificationStatus } from "@bookflow/database";
import {
  createBookingConfirmationNotifications,
  scheduleBookingReminders,
  sendNotification,
} from "@/lib/services/notifications";
import { syncCalendarEvent } from "@/lib/integrations/google-calendar";
import { processStripeWebhook } from "@/lib/integrations/stripe-webhooks";

// ============================================================
// BOOKING EVENTS
// ============================================================

export const onBookingCreated = inngest.createFunction(
  {
    id: "booking-created",
    name: "Handle booking created",
    retries: 3,
  },
  { event: "booking/created" },
  async ({ event, step }) => {
    const { appointmentId, tenantId } = event.data;

    // Create notification records
    await step.run("create-notifications", async () => {
      await createBookingConfirmationNotifications(appointmentId);
    });

    // Schedule reminders
    await step.run("schedule-reminders", async () => {
      await scheduleBookingReminders(appointmentId);
    });

    // Sync to Google Calendar
    await step.run("sync-calendar", async () => {
      await syncCalendarEvent(appointmentId, "create");
    });

    // Send confirmation notifications immediately
    await step.run("send-confirmations", async () => {
      const notifications = await prisma.notification.findMany({
        where: {
          appointmentId,
          status: NotificationStatus.PENDING,
          scheduledFor: { lte: new Date() },
        },
      });

      for (const notification of notifications) {
        await sendNotification(notification.id);
      }
    });
  },
);

export const onBookingCancelled = inngest.createFunction(
  {
    id: "booking-cancelled",
    name: "Handle booking cancelled",
    retries: 3,
  },
  { event: "booking/cancelled" },
  async ({ event, step }) => {
    const { appointmentId } = event.data;

    await step.run("cancel-pending-reminders", async () => {
      await prisma.notification.updateMany({
        where: {
          appointmentId,
          status: NotificationStatus.PENDING,
        },
        data: { status: NotificationStatus.FAILED, failureReason: "Appointment cancelled" },
      });
    });

    await step.run("create-cancellation-notifications", async () => {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { customer: true, service: true, tenant: true },
      });

      if (!appointment) return;

      await prisma.notification.create({
        data: {
          tenantId: appointment.tenantId,
          appointmentId,
          customerId: appointment.customerId,
          type: "BOOKING_CANCELLATION",
          channel: "EMAIL",
          status: NotificationStatus.PENDING,
          recipient: appointment.customer.email,
          subject: `Booking Cancelled - ${appointment.service.name}`,
          body: `Your booking for ${appointment.service.name} has been cancelled.`,
          scheduledFor: new Date(),
        },
      });
    });

    await step.run("send-cancellation-email", async () => {
      const notifications = await prisma.notification.findMany({
        where: {
          appointmentId,
          status: NotificationStatus.PENDING,
          scheduledFor: { lte: new Date() },
        },
      });

      for (const n of notifications) {
        await sendNotification(n.id);
      }
    });

    await step.run("delete-calendar-event", async () => {
      await syncCalendarEvent(appointmentId, "delete");
    });
  },
);

export const onBookingRescheduled = inngest.createFunction(
  {
    id: "booking-rescheduled",
    name: "Handle booking rescheduled",
    retries: 3,
  },
  { event: "booking/rescheduled" },
  async ({ event, step }) => {
    const { appointmentId, oldAppointmentId } = event.data;

    await step.run("cancel-old-reminders", async () => {
      await prisma.notification.updateMany({
        where: {
          appointmentId: oldAppointmentId,
          status: NotificationStatus.PENDING,
        },
        data: { status: NotificationStatus.FAILED, failureReason: "Appointment rescheduled" },
      });
    });

    await step.run("setup-new-notifications", async () => {
      await createBookingConfirmationNotifications(appointmentId);
      await scheduleBookingReminders(appointmentId);
    });

    await step.run("update-calendar-event", async () => {
      await syncCalendarEvent(oldAppointmentId, "delete");
      await syncCalendarEvent(appointmentId, "create");
    });
  },
);

// ============================================================
// NOTIFICATION PROCESSING
// ============================================================

export const onSendNotification = inngest.createFunction(
  {
    id: "send-notification",
    name: "Send notification",
    retries: 3,
  },
  { event: "notification/send" },
  async ({ event }) => {
    await sendNotification(event.data.notificationId);
  },
);

// Cron: Process pending reminders every minute
export const sendPendingReminders = inngest.createFunction(
  {
    id: "send-pending-reminders",
    name: "Send pending reminders",
    retries: 1,
  },
  { cron: "* * * * *" }, // every minute
  async ({ step }) => {
    await step.run("find-and-send", async () => {
      const due = await prisma.notification.findMany({
        where: {
          status: NotificationStatus.PENDING,
          scheduledFor: { lte: new Date() },
        },
        take: 50, // process in batches
        orderBy: { scheduledFor: "asc" },
      });

      for (const notification of due) {
        try {
          await sendNotification(notification.id);
        } catch (err) {
          console.error(`Failed to send notification ${notification.id}:`, err);
        }
      }
    });
  },
);

// ============================================================
// STRIPE WEBHOOK PROCESSING
// ============================================================

export const onStripeWebhook = inngest.createFunction(
  {
    id: "stripe-webhook",
    name: "Process Stripe webhook",
    retries: 3,
    idempotency: "event.data.eventId", // prevent duplicate processing
  },
  { event: "stripe/webhook" },
  async ({ event, step }) => {
    await step.run("process-webhook", async () => {
      await processStripeWebhook(event.data.eventId, event.data.type, event.data.payload);
    });
  },
);

// ============================================================
// DAILY ANALYTICS JOB
// ============================================================

export const generateDailyAnalytics = inngest.createFunction(
  {
    id: "daily-analytics",
    name: "Generate daily analytics",
    retries: 1,
  },
  { cron: "0 0 * * *" }, // midnight UTC
  async ({ step }) => {
    await step.run("reset-monthly-booking-counts", async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (now.getDate() === 1) {
        await prisma.subscription.updateMany({
          where: { periodResetAt: { lt: firstOfMonth } },
          data: {
            bookingsThisMonth: 0,
            periodResetAt: now,
          },
        });
      }
    });
  },
);

// Export all functions for Inngest serve
export const inngestFunctions = [
  onBookingCreated,
  onBookingCancelled,
  onBookingRescheduled,
  onSendNotification,
  sendPendingReminders,
  onStripeWebhook,
  generateDailyAnalytics,
];
