/**
 * Notification Service
 * Abstraction layer over email, SMS, WhatsApp, and in-app notifications.
 * All notification sending is done via background jobs.
 */

import {
  prisma,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@bookflow/database";
import { Resend } from "resend";
import twilio from "twilio";

const resend = process.env["RESEND_API_KEY"] ? new Resend(process.env["RESEND_API_KEY"]) : null;

const twilioClient =
  process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]
    ? twilio(process.env["TWILIO_ACCOUNT_SID"], process.env["TWILIO_AUTH_TOKEN"])
    : null;

// ============================================================
// SEND NOTIFICATION
// ============================================================

export async function sendNotification(notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw new Error("Notification not found");
  if (notification.status === NotificationStatus.SENT) return;

  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.QUEUED },
    });

    switch (notification.channel) {
      case NotificationChannel.EMAIL:
        await sendEmail(
          notification.recipient,
          notification.subject ?? "Notification",
          notification.body,
        );
        break;
      case NotificationChannel.SMS:
        await sendSms(notification.recipient, notification.body);
        break;
      case NotificationChannel.WHATSAPP:
        await sendWhatsApp(notification.recipient, notification.body);
        break;
      case NotificationChannel.IN_APP:
        // In-app notifications are created in DB and pushed via SSE
        break;
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    const retryCount = notification.retryCount + 1;
    const shouldRetry = retryCount < notification.maxRetries;

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: shouldRetry ? NotificationStatus.PENDING : NotificationStatus.FAILED,
        failedAt: shouldRetry ? null : new Date(),
        failureReason: error instanceof Error ? error.message : "Unknown error",
        retryCount,
      },
    });

    if (!shouldRetry) throw error;
  }
}

// ============================================================
// CREATE NOTIFICATION RECORDS
// ============================================================

export async function createBookingConfirmationNotifications(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      tenant: { include: { notificationPrefs: true } },
      service: true,
      staff: true,
      customer: true,
    },
  });

  if (!appointment) throw new Error("Appointment not found");

  const { tenant, service, staff, customer } = appointment;

  // Customer email confirmation
  const emailEnabled =
    tenant.notificationPrefs.find(
      (p) =>
        p.type === NotificationType.BOOKING_CONFIRMATION && p.channel === NotificationChannel.EMAIL,
    )?.enabled !== false;

  if (emailEnabled && customer.email) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        appointmentId,
        customerId: customer.id,
        type: NotificationType.BOOKING_CONFIRMATION,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        recipient: customer.email,
        subject: `Booking Confirmation - ${service.name} at ${tenant.name}`,
        body: buildBookingConfirmationEmailBody(appointment),
        scheduledFor: new Date(),
      },
    });
  }

  // SMS if customer has phone and tenant has SMS enabled
  if (customer.phone) {
    const smsEnabled = tenant.notificationPrefs.find(
      (p) =>
        p.type === NotificationType.BOOKING_CONFIRMATION && p.channel === NotificationChannel.SMS,
    )?.enabled;

    if (smsEnabled) {
      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          appointmentId,
          customerId: customer.id,
          type: NotificationType.BOOKING_CONFIRMATION,
          channel: NotificationChannel.SMS,
          status: NotificationStatus.PENDING,
          recipient: customer.phone,
          body: buildBookingConfirmationSmsBody(appointment),
          scheduledFor: new Date(),
        },
      });
    }
  }

  // Staff notification
  if (staff?.email) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        appointmentId,
        staffId: staff.id,
        type: NotificationType.STAFF_NEW_BOOKING,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        recipient: staff.email,
        subject: `New Booking: ${customer.name} - ${service.name}`,
        body: buildStaffBookingNotificationBody(appointment),
        scheduledFor: new Date(),
      },
    });
  }
}

export async function scheduleBookingReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      tenant: { include: { notificationPrefs: true } },
      customer: true,
      service: { select: { name: true } },
    },
  });

  if (!appointment) return;

  const reminderPrefs = appointment.tenant.notificationPrefs.filter(
    (p) => p.type === NotificationType.BOOKING_REMINDER && p.enabled,
  );

  for (const pref of reminderPrefs) {
    if (!pref.hoursBeforeReminder) continue;

    const scheduledFor = new Date(
      appointment.startTime.getTime() - pref.hoursBeforeReminder * 60 * 60 * 1000,
    );

    // Don't schedule if in the past
    if (scheduledFor <= new Date()) continue;

    const recipient =
      pref.channel === NotificationChannel.EMAIL
        ? appointment.customer.email
        : appointment.customer.phone;

    if (!recipient) continue;

    await prisma.notification.create({
      data: {
        tenantId: appointment.tenantId,
        appointmentId,
        customerId: appointment.customerId,
        type: NotificationType.BOOKING_REMINDER,
        channel: pref.channel,
        status: NotificationStatus.PENDING,
        recipient,
        subject: `Reminder: Your appointment is in ${pref.hoursBeforeReminder} hour(s)`,
        body: buildReminderBody(appointment, pref.hoursBeforeReminder),
        scheduledFor,
      },
    });
  }
}

// ============================================================
// PROVIDER FUNCTIONS
// ============================================================

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log("[Email] Resend not configured. Would send to:", to);
    return;
  }

  await resend.emails.send({
    from: process.env["EMAIL_FROM"] ?? "BookFlow <noreply@bookflow.app>",
    to,
    subject,
    html,
    replyTo: process.env["EMAIL_REPLY_TO"],
  });
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!twilioClient) {
    console.log("[SMS] Twilio not configured. Would send to:", to);
    return;
  }

  await twilioClient.messages.create({
    from: process.env["TWILIO_PHONE_NUMBER"]!,
    to,
    body,
  });
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!twilioClient) {
    console.log("[WhatsApp] Twilio not configured. Would send to:", to);
    return;
  }

  await twilioClient.messages.create({
    from: process.env["TWILIO_WHATSAPP_NUMBER"]!,
    to: `whatsapp:${to}`,
    body,
  });
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function buildBookingConfirmationEmailBody(appointment: {
  bookingReference: string;
  startTime: Date;
  timezone: string;
  service: { name: string; duration: number };
  staff: { name: string } | null;
  customer: { name: string };
  tenant: { name: string };
}): string {
  const { bookingReference, startTime, service, staff, customer, tenant } = appointment;
  const formattedTime = startTime.toLocaleString("en-US", {
    timeZone: appointment.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Booking Confirmation</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6366f1; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Booking Confirmed ✓</h1>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
    <p>Hi ${customer.name},</p>
    <p>Your appointment has been confirmed at <strong>${tenant.name}</strong>.</p>
    
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 12px 0; color: #111827;">Appointment Details</h3>
      <p style="margin: 4px 0;"><strong>Service:</strong> ${service.name}</p>
      <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formattedTime}</p>
      <p style="margin: 4px 0;"><strong>Duration:</strong> ${service.duration} minutes</p>
      ${staff ? `<p style="margin: 4px 0;"><strong>Staff:</strong> ${staff.name}</p>` : ""}
      <p style="margin: 4px 0;"><strong>Reference:</strong> #${bookingReference.slice(-8).toUpperCase()}</p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">Need to make changes? Use your booking reference to reschedule or cancel.</p>
  </div>
</body>
</html>`;
}

function buildStaffBookingNotificationBody(appointment: {
  startTime: Date;
  timezone: string;
  service: { name: string; duration: number };
  customer: { name: string; email: string; phone?: string | null };
  tenant: { name: string };
}): string {
  const { startTime, service, customer, tenant } = appointment;
  const formattedTime = startTime.toLocaleString("en-US", {
    timeZone: appointment.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
<p>You have a new booking at <strong>${tenant.name}</strong>.</p>
<p><strong>Customer:</strong> ${customer.name} (${customer.email}${customer.phone ? `, ${customer.phone}` : ""})</p>
<p><strong>Service:</strong> ${service.name}</p>
<p><strong>When:</strong> ${formattedTime}</p>
<p><strong>Duration:</strong> ${service.duration} minutes</p>
`;
}

function buildBookingConfirmationSmsBody(appointment: {
  startTime: Date;
  timezone: string;
  service: { name: string };
  tenant: { name: string };
  bookingReference: string;
}): string {
  const formattedTime = appointment.startTime.toLocaleString("en-US", {
    timeZone: appointment.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return `✓ Booking confirmed at ${appointment.tenant.name}! ${appointment.service.name} on ${formattedTime}. Ref: #${appointment.bookingReference.slice(-8).toUpperCase()}`;
}

function buildReminderBody(
  appointment: {
    startTime: Date;
    timezone: string;
    service: { name: string };
    tenant: { name: string };
  },
  hoursBeforeReminder: number,
): string {
  const formattedTime = appointment.startTime.toLocaleString("en-US", {
    timeZone: appointment.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Reminder: Your ${appointment.service.name} appointment at ${appointment.tenant.name} is in ${hoursBeforeReminder} hour(s) (${formattedTime}).`;
}
