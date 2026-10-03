/**
 * Unit tests for the availability engine.
 * These tests validate the core scheduling logic without requiring a database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateAppointmentEndTime,
  calculateAppointmentDisplayEndTime,
} from "@/lib/services/availability";
import { addMinutes } from "date-fns";

// ============================================================
// calculateAppointmentEndTime
// ============================================================
describe("calculateAppointmentEndTime", () => {
  it("returns startTime + duration when no buffer", () => {
    const start = new Date("2026-09-12T10:00:00Z");
    const end = calculateAppointmentEndTime(start, 60, 0);
    expect(end).toEqual(addMinutes(start, 60));
  });

  it("includes buffer time in end time", () => {
    const start = new Date("2026-09-12T10:00:00Z");
    const end = calculateAppointmentEndTime(start, 60, 15);
    expect(end).toEqual(addMinutes(start, 75));
  });

  it("uses zero buffer as default", () => {
    const start = new Date("2026-09-12T09:00:00Z");
    const end = calculateAppointmentEndTime(start, 30);
    expect(end).toEqual(addMinutes(start, 30));
  });

  it("handles short durations correctly", () => {
    const start = new Date("2026-09-12T14:55:00Z");
    const end = calculateAppointmentEndTime(start, 5, 0);
    expect(end).toEqual(new Date("2026-09-12T15:00:00Z"));
  });

  it("handles maximum duration (8h + buffer)", () => {
    const start = new Date("2026-09-12T08:00:00Z");
    const end = calculateAppointmentEndTime(start, 480, 30);
    expect(end).toEqual(addMinutes(start, 510));
  });
});

// ============================================================
// calculateAppointmentDisplayEndTime
// ============================================================
describe("calculateAppointmentDisplayEndTime", () => {
  it("returns startTime + duration without buffer", () => {
    const start = new Date("2026-09-12T10:00:00Z");
    const display = calculateAppointmentDisplayEndTime(start, 60);
    expect(display).toEqual(new Date("2026-09-12T11:00:00Z"));
  });
});

// ============================================================
// Slot overlap detection logic
// ============================================================
describe("Slot overlap detection", () => {
  // Reproduce the overlap logic from the availability engine
  function slotsOverlap(
    start1: Date, end1: Date,
    start2: Date, end2: Date,
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  it("detects full overlap", () => {
    const s1 = new Date("2026-09-12T10:00:00Z");
    const e1 = new Date("2026-09-12T11:00:00Z");
    const s2 = new Date("2026-09-12T10:30:00Z");
    const e2 = new Date("2026-09-12T11:30:00Z");
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(true);
  });

  it("detects contained overlap", () => {
    const s1 = new Date("2026-09-12T09:00:00Z");
    const e1 = new Date("2026-09-12T12:00:00Z");
    const s2 = new Date("2026-09-12T10:00:00Z");
    const e2 = new Date("2026-09-12T11:00:00Z");
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(true);
  });

  it("returns false for adjacent slots (no gap needed)", () => {
    const s1 = new Date("2026-09-12T09:00:00Z");
    const e1 = new Date("2026-09-12T10:00:00Z");
    const s2 = new Date("2026-09-12T10:00:00Z");
    const e2 = new Date("2026-09-12T11:00:00Z");
    // Adjacent slots do NOT overlap — end1 === start2
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(false);
  });

  it("returns false for non-overlapping slots", () => {
    const s1 = new Date("2026-09-12T09:00:00Z");
    const e1 = new Date("2026-09-12T10:00:00Z");
    const s2 = new Date("2026-09-12T11:00:00Z");
    const e2 = new Date("2026-09-12T12:00:00Z");
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(false);
  });

  it("detects overlap even with 1 minute difference", () => {
    const s1 = new Date("2026-09-12T10:00:00Z");
    const e1 = new Date("2026-09-12T11:01:00Z");
    const s2 = new Date("2026-09-12T11:00:00Z");
    const e2 = new Date("2026-09-12T12:00:00Z");
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(true);
  });

  it("detects overlap when second slot starts before first ends", () => {
    const s1 = new Date("2026-09-12T10:00:00Z");
    const e1 = new Date("2026-09-12T11:00:00Z");
    const s2 = new Date("2026-09-12T10:59:00Z");
    const e2 = new Date("2026-09-12T12:00:00Z");
    expect(slotsOverlap(s1, e1, s2, e2)).toBe(true);
  });
});

// ============================================================
// Pricing calculations
// ============================================================
describe("Pricing calculations", () => {
  function calculateDeposit(price: number, depositPercentage: number): number {
    return Math.round(price * (depositPercentage / 100) * 100) / 100;
  }

  it("calculates 20% deposit correctly", () => {
    expect(calculateDeposit(100, 20)).toBe(20);
  });

  it("calculates 50% deposit correctly", () => {
    expect(calculateDeposit(150, 50)).toBe(75);
  });

  it("handles zero deposit", () => {
    expect(calculateDeposit(100, 0)).toBe(0);
  });

  it("handles 100% deposit (full prepayment)", () => {
    expect(calculateDeposit(99.99, 100)).toBe(99.99);
  });

  it("rounds to 2 decimal places", () => {
    expect(calculateDeposit(100, 33)).toBe(33);
  });
});

// ============================================================
// Booking window validation
// ============================================================
describe("Booking window validation", () => {
  function isWithinBookingWindow(date: Date, windowDays: number): boolean {
    const now = new Date();
    const maxDate = addMinutes(now, windowDays * 24 * 60);
    return date <= maxDate;
  }

  function isAfterLeadTime(slotTime: Date, leadTimeMinutes: number): boolean {
    const minTime = addMinutes(new Date(), leadTimeMinutes);
    return slotTime >= minTime;
  }

  it("accepts date within booking window", () => {
    const futureDate = addMinutes(new Date(), 30 * 24 * 60); // 30 days ahead
    expect(isWithinBookingWindow(futureDate, 60)).toBe(true);
  });

  it("rejects date beyond booking window", () => {
    const farFuture = addMinutes(new Date(), 120 * 24 * 60); // 120 days ahead
    expect(isWithinBookingWindow(farFuture, 60)).toBe(false);
  });

  it("accepts slot after lead time", () => {
    const validSlot = addMinutes(new Date(), 120); // 2h from now
    expect(isAfterLeadTime(validSlot, 60)).toBe(true); // 1h lead time
  });

  it("rejects slot within lead time", () => {
    const tooSoon = addMinutes(new Date(), 30); // 30min from now
    expect(isAfterLeadTime(tooSoon, 60)).toBe(false); // 1h lead time
  });
});
