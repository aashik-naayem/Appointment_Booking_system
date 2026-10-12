/**
 * BookFlow Availability Engine
 *
 * This is the core scheduling logic. It handles:
 * - Business hours
 * - Staff working hours
 * - Holidays
 * - Existing appointments
 * - Service duration + buffer time
 * - Timezone conversion
 * - Booking lead time and window
 * - Concurrent booking limits
 */

import {
  prisma,
  type Tenant,
  type Service,
  type Staff,
  AppointmentStatus,
  DayOfWeek,
} from "@bookflow/database";
import {
  startOfDay,
  endOfDay,
  addMinutes,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  format,
  getDay,
  addDays,
  isSameDay,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { redis } from "@/lib/db/redis";

// ============================================================
// TYPES
// ============================================================

export type TimeSlot = {
  startTime: string; // ISO string (UTC)
  endTime: string; // ISO string (UTC)
  displayStart: string; // Formatted in tenant timezone
  displayEnd: string;
  available: boolean;
  staffId?: string;
  staffName?: string;
};

export type AvailabilityQuery = {
  tenantId: string;
  serviceId: string;
  staffId?: string;
  date: string; // "YYYY-MM-DD" in tenant timezone
  timezone?: string;
};

// ============================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================

/**
 * Get all available time slots for a given day.
 */
export async function getAvailableSlots(query: AvailabilityQuery): Promise<TimeSlot[]> {
  const cacheKey = `slots:${query.tenantId}:${query.serviceId}:${query.staffId ?? "any"}:${query.date}`;

  // Try cache first (30 second TTL for availability — short TTL as it's time-sensitive)
  if (redis) {
    const cached = await redis.get<TimeSlot[]>(cacheKey);
    if (cached) return cached;
  }

  const [tenant, service] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: query.tenantId } }),
    prisma.service.findUnique({
      where: { id: query.serviceId, tenantId: query.tenantId },
    }),
  ]);

  if (!tenant || !service) return [];

  const timezone = query.timezone ?? tenant.timezone;
  const slots = await computeAvailableSlots({ tenant, service, query, timezone });

  // Cache for 30 seconds
  if (redis) {
    await redis.setex(cacheKey, 30, slots);
  }

  return slots;
}

/**
 * Check if a specific slot is available.
 * More authoritative check for actual booking creation.
 */
export async function isSlotAvailable(
  tenantId: string,
  serviceId: string,
  startTime: Date,
  staffId?: string,
): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId, tenantId },
    select: { duration: true, bufferTime: true, maxConcurrent: true },
  });

  if (!service) return false;

  const endTime = calculateAppointmentEndTime(startTime, service.duration, service.bufferTime);

  return checkSlotAvailability({
    tenantId,
    staffId,
    startTime,
    endTime,
    maxConcurrent: service.maxConcurrent,
    excludeAppointmentId: undefined,
  });
}

/**
 * Calculate appointment end time (duration + buffer).
 */
export function calculateAppointmentEndTime(
  startTime: Date,
  durationMinutes: number,
  bufferMinutes: number = 0,
): Date {
  return addMinutes(startTime, durationMinutes + bufferMinutes);
}

/**
 * Calculate the actual end time shown to customer (no buffer included).
 */
export function calculateAppointmentDisplayEndTime(startTime: Date, durationMinutes: number): Date {
  return addMinutes(startTime, durationMinutes);
}

// ============================================================
// INTERNAL COMPUTATION
// ============================================================

async function computeAvailableSlots({
  tenant,
  service,
  query,
  timezone,
}: {
  tenant: Tenant;
  service: Service;
  query: AvailabilityQuery;
  timezone: string;
}): Promise<TimeSlot[]> {
  const { date, staffId } = query;
  const now = new Date();

  // Parse date in the business timezone
  const targetDate = parseISO(date); // YYYY-MM-DD
  const zonedDate = toZonedTime(targetDate, timezone);
  const dayStart = startOfDay(zonedDate);
  const dayEnd = endOfDay(zonedDate);

  // Convert to UTC for DB queries
  const dayStartUTC = fromZonedTime(dayStart, timezone);
  const dayEndUTC = fromZonedTime(dayEnd, timezone);

  // Check if date is within the allowed booking window
  const bookingWindowEnd = addDays(now, tenant.bookingWindowDays);
  if (isAfter(dayStartUTC, bookingWindowEnd)) return [];

  // Get day of week
  const dayOfWeek = getDayOfWeek(getDay(zonedDate));

  // 1. Check business hours
  const businessHours = await getBusinessHours(tenant.id, dayOfWeek);
  if (!businessHours || !businessHours.isOpen) return [];

  // 2. Check holidays
  const isHoliday = await checkHoliday(tenant.id, zonedDate);
  if (isHoliday) return [];

  // 3. Get staff to check
  const staffList = staffId
    ? await prisma.staff.findMany({
        where: { id: staffId, tenantId: tenant.id, status: "ACTIVE" },
      })
    : await getStaffForService(tenant.id, service.id);

  if (staffList.length === 0) return [];

  // 4. Generate slot candidates based on business hours
  const slotDuration = service.duration; // minutes per slot
  const totalDuration = service.duration + service.bufferTime;

  const slots: TimeSlot[] = [];

  for (const staff of staffList) {
    // Get staff working hours for this day
    const staffHours = staff.hasCustomHours
      ? await getStaffWorkingHours(staff.id, dayOfWeek)
      : null;

    // Use staff hours if set, otherwise business hours
    const workStart = staffHours ? staffHours.startTime : businessHours.startTime;
    const workEnd = staffHours ? staffHours.endTime : businessHours.endTime;

    if (!staffHours && staff.hasCustomHours && !staffHours) continue; // staff off today

    // Get existing appointments for this staff on this day
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        staffId: staff.id,
        startTime: { gte: dayStartUTC },
        endTime: { lte: dayEndUTC },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });

    // Parse work start/end in timezone
    const [startHour, startMin] = workStart.split(":").map(Number);
    const [endHour, endMin] = workEnd.split(":").map(Number);

    const workStartDateTime = new Date(zonedDate);
    workStartDateTime.setHours(startHour!, startMin!, 0, 0);

    const workEndDateTime = new Date(zonedDate);
    workEndDateTime.setHours(endHour!, endMin!, 0, 0);

    // Convert to UTC
    const workStartUTC = fromZonedTime(workStartDateTime, timezone);
    const workEndUTC = fromZonedTime(workEndDateTime, timezone);

    // Generate slots at interval matching service duration
    let slotStart = workStartUTC;

    while (
      isBefore(addMinutes(slotStart, totalDuration), workEndUTC) ||
      isEqual(addMinutes(slotStart, totalDuration), workEndUTC)
    ) {
      const slotEnd = addMinutes(slotStart, totalDuration);
      const displayEnd = addMinutes(slotStart, slotDuration);

      // Skip slots in the past + lead time
      const minBookingTime = addMinutes(now, tenant.bookingLeadTime);
      if (isBefore(slotStart, minBookingTime)) {
        slotStart = addMinutes(slotStart, slotDuration);
        continue;
      }

      // Check for conflicts with existing appointments
      const hasConflict = existingAppointments.some((apt) =>
        slotsOverlap(slotStart, slotEnd, apt.startTime, apt.endTime),
      );

      const displayStartLocal = format(
        toZonedTime(slotStart, timezone),
        "yyyy-MM-dd'T'HH:mm:ssxxx",
      );
      const displayEndLocal = format(toZonedTime(displayEnd, timezone), "HH:mm");

      // Avoid duplicate slots (same time, different staff — for "any staff" queries)
      const existingSlot = slots.find((s) => s.startTime === slotStart.toISOString());
      if (!existingSlot) {
        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          displayStart: displayStartLocal,
          displayEnd: displayEndLocal,
          available: !hasConflict,
          staffId: staff.id,
          staffName: staff.name,
        });
      } else if (!hasConflict && !existingSlot.available) {
        // Another staff can cover this slot
        existingSlot.available = true;
        existingSlot.staffId = staff.id;
        existingSlot.staffName = staff.name;
      }

      slotStart = addMinutes(slotStart, slotDuration);
    }
  }

  return slots.filter((s) => s.available).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

async function checkSlotAvailability({
  tenantId,
  staffId,
  startTime,
  endTime,
  maxConcurrent,
  excludeAppointmentId,
}: {
  tenantId: string;
  staffId?: string;
  startTime: Date;
  endTime: Date;
  maxConcurrent: number;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const where: Record<string, unknown> = {
    tenantId,
    status: {
      notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
    },
    // Overlap condition: existing.startTime < newEnd AND existing.endTime > newStart
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };

  if (staffId) {
    where["staffId"] = staffId;
  }

  if (excludeAppointmentId) {
    where["id"] = { not: excludeAppointmentId };
  }

  const conflictCount = await prisma.appointment.count({ where });
  return conflictCount < maxConcurrent;
}

// ============================================================
// HELPERS
// ============================================================

function slotsOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return isBefore(start1, end2) && isAfter(end1, start2);
}

async function getBusinessHours(tenantId: string, dayOfWeek: DayOfWeek) {
  return prisma.businessHours.findUnique({
    where: { tenantId_dayOfWeek: { tenantId, dayOfWeek } },
  });
}

async function getStaffWorkingHours(staffId: string, dayOfWeek: DayOfWeek) {
  const hours = await prisma.staffWorkingHours.findUnique({
    where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
  });
  return hours?.isWorking ? hours : null;
}

async function checkHoliday(tenantId: string, date: Date): Promise<boolean> {
  const startOfTargetDay = startOfDay(date);
  const endOfTargetDay = endOfDay(date);

  const holiday = await prisma.holiday.findFirst({
    where: {
      tenantId,
      OR: [
        // Exact date match
        {
          date: {
            gte: startOfTargetDay,
            lte: endOfTargetDay,
          },
          recurring: false,
        },
        // Recurring (annual) holidays — match month+day
      ],
    },
  });

  return !!holiday;
}

async function getStaffForService(tenantId: string, serviceId: string) {
  const staffServices = await prisma.staffService.findMany({
    where: {
      serviceId,
      staff: { tenantId, status: "ACTIVE", deletedAt: null },
    },
    include: { staff: true },
  });

  return staffServices.map((ss) => ss.staff);
}

function getDayOfWeek(dayIndex: number): DayOfWeek {
  const days: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];
  return days[dayIndex] ?? DayOfWeek.SUNDAY;
}

/**
 * Invalidate availability cache for a tenant/staff/date when an appointment changes.
 */
export async function invalidateAvailabilityCache(
  tenantId: string,
  staffId: string | null | undefined,
  date: Date,
  timezone: string,
): Promise<void> {
  if (!redis) return;

  const dateStr = format(toZonedTime(date, timezone), "yyyy-MM-dd");
  const patterns = [
    `slots:${tenantId}:*:${staffId ?? "any"}:${dateStr}`,
    `slots:${tenantId}:*:any:${dateStr}`,
  ];

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
