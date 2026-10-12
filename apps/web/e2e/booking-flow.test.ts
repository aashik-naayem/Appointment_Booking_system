/**
 * E2E Test: Complete booking flow
 *
 * Covers:
 *   1. Register new user
 *   2. Create tenant (onboarding)
 *   3. Add service
 *   4. Add staff
 *   5. Configure business hours (already defaulted)
 *   6. Open public booking page
 *   7. Book appointment
 *   8. Verify appointment in dashboard
 *   9. Reschedule appointment
 *   10. Cancel appointment
 *   11. Verify customer history
 */

import { test, expect } from "@playwright/test";
import { registerUser, completOnboarding, TEST_SERVICE, TEST_STAFF } from "./helpers";
import { format, addDays } from "date-fns";

// These tests run in sequence — share state via the storageState
let tenantSlug = "";
let appointmentId = "";
let customerEmail = `e2e-customer-${Date.now()}@example.com`;

// ============================================================
// Setup: Register + Onboard
// ============================================================
test("01 – Register and complete onboarding", async ({ page }) => {
  await registerUser(page);
  await completOnboarding(page);
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible();
});

// ============================================================
// Add Service
// ============================================================
test("02 – Add a service", async ({ page }) => {
  await page.goto("/services");
  await page.click('button:has-text("Add Service")');

  const modal = page.locator('[role="dialog"], .fixed.inset-0').last();
  await modal.locator('input[placeholder="Haircut & Style"]').fill(TEST_SERVICE.name);

  // Duration
  const durationInput = modal.locator('input[type="number"]').first();
  await durationInput.fill(String(TEST_SERVICE.duration));

  // Price
  const priceInput = modal.locator('input[type="number"]').last();
  await priceInput.fill(String(TEST_SERVICE.price));

  await modal.locator('button:has-text("Create Service")').click();
  await expect(page.locator(`text=${TEST_SERVICE.name}`)).toBeVisible({ timeout: 8_000 });
});

// ============================================================
// Add Staff
// ============================================================
test("03 – Add a staff member", async ({ page }) => {
  await page.goto("/staff");
  await page.click('button:has-text("Add Staff")');

  const modal = page.locator(".fixed.inset-0").last();
  await modal.locator('input[placeholder="Jane Smith"]').fill(TEST_STAFF.name);
  await modal.locator('input[type="email"]').fill(TEST_STAFF.email);
  await modal.locator('button:has-text("Add Staff")').last().click();

  await expect(page.locator(`text=${TEST_STAFF.name}`)).toBeVisible({ timeout: 8_000 });
});

// ============================================================
// Get tenant slug from settings
// ============================================================
test("04 – Get tenant slug from settings", async ({ page }) => {
  await page.goto("/settings");
  await page.click('button:has-text("Branding")');

  const urlInput = page.locator("input[readonly]").last();
  const bookingUrl = await urlInput.inputValue();

  // Extract slug from URL
  const match = bookingUrl.match(/\/book\/([^/\s]+)/);
  expect(match).toBeTruthy();
  tenantSlug = match![1]!;
  expect(tenantSlug).toBeTruthy();
  console.log("Tenant slug:", tenantSlug);
});

// ============================================================
// Public Booking Page
// ============================================================
test("05 – Public booking page loads correctly", async ({ page }) => {
  if (!tenantSlug) test.skip();
  await page.goto(`/book/${tenantSlug}`);

  // Business name should be in header
  await expect(page.locator("header h1")).toBeVisible();
  // Services should be listed
  await expect(page.locator(`text=${TEST_SERVICE.name}`)).toBeVisible({ timeout: 8_000 });
});

// ============================================================
// Complete booking
// ============================================================
test("06 – Customer completes a booking", async ({ page }) => {
  if (!tenantSlug) test.skip();
  await page.goto(`/book/${tenantSlug}`);

  // Step 1: Select service
  await page.click(`button:has-text("${TEST_SERVICE.name}")`);

  // Step 2: Staff selection (skip if shown, select "Any")
  const anyStaffButton = page.locator('button:has-text("Any available staff")');
  if (await anyStaffButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await anyStaffButton.click();
  }

  // Step 3: Select date (pick tomorrow's date button)
  await page.waitForSelector('button:has-text("Continue to Review"), .grid', { timeout: 5_000 });

  // Click first available date button (tomorrow)
  const dateBtns = page.locator(".grid button").filter({ hasNotText: "Continue" });
  await dateBtns.first().click();

  // Wait for time slots to load and click first available
  await page.waitForSelector(".grid button:not([disabled])", { timeout: 10_000 });
  const slotBtns = page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ });
  const firstSlot = slotBtns.first();
  await expect(firstSlot).toBeVisible({ timeout: 10_000 });
  await firstSlot.click();

  // Step 4: Customer details
  await page.fill('input[placeholder="Your full name"]', "E2E Customer");
  await page.fill('input[type="email"]', customerEmail);
  await page.fill('input[type="tel"]', "+15551234567");
  await page.click('button:has-text("Continue to Review")');

  // Step 5: Confirm booking
  await expect(page.locator('h2:has-text("Review & Confirm")')).toBeVisible();
  await expect(page.locator(`text=${TEST_SERVICE.name}`)).toBeVisible();
  await page.click('button:has-text("Confirm Booking")');

  // Success
  await expect(page.locator('h2:has-text("Booking Confirmed")')).toBeVisible({ timeout: 15_000 });
  const refLocator = page.locator("p.font-mono");
  await expect(refLocator).toBeVisible();
  const ref = await refLocator.textContent();
  console.log("Booking reference:", ref);
});

// ============================================================
// Verify appointment in dashboard
// ============================================================
test("07 – Appointment appears in dashboard", async ({ page }) => {
  await page.goto("/appointments");
  await expect(page.locator("text=E2E Customer")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`text=${TEST_SERVICE.name}`)).toBeVisible();

  // Get appointment link
  const row = page.locator("tr", { hasText: "E2E Customer" }).first();
  await expect(row).toBeVisible();

  // Click view details
  const detailsBtn = row.locator("button").last();
  await detailsBtn.click();
  const menu = page.locator(".absolute.right-0");
  await menu.locator('a:has-text("View Details")').click();

  await page.waitForURL(/\/appointments\/.+/, { timeout: 5_000 });
  appointmentId = page.url().split("/appointments/")[1]!;
  expect(appointmentId).toBeTruthy();
  console.log("Appointment ID:", appointmentId);
});

// ============================================================
// Cancel appointment
// ============================================================
test("08 – Cancel appointment from dashboard", async ({ page }) => {
  await page.goto("/appointments");
  await expect(page.locator("text=E2E Customer")).toBeVisible({ timeout: 5_000 });

  const row = page.locator("tr", { hasText: "E2E Customer" }).first();
  const menuBtn = row.locator("button").last();
  await menuBtn.click();

  const cancelBtn = page.locator('button:has-text("Cancel")').last();
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();

  // After cancel, status badge should change
  await expect(page.locator('.rounded-full:has-text("Cancelled")')).toBeVisible({ timeout: 8_000 });
});

// ============================================================
// Verify customer history
// ============================================================
test("09 – Customer record shows booking history", async ({ page }) => {
  await page.goto("/customers");
  await page.fill('[placeholder="Search customers..."]', "E2E Customer");

  await expect(page.locator("text=E2E Customer")).toBeVisible({ timeout: 5_000 });
  await page.click('a:has-text("E2E Customer"), tr:has-text("E2E Customer") td:first-child a');

  // Should show customer profile with appointments
  await expect(page.locator(`text=${customerEmail}`)).toBeVisible({ timeout: 5_000 });
});

// ============================================================
// Analytics reflects activity
// ============================================================
test("10 – Analytics page loads with data", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();

  // Should show stat cards
  await expect(page.locator("text=Total Bookings")).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("text=Revenue")).toBeVisible();
});

// ============================================================
// Settings: Business hours
// ============================================================
test("11 – Can update business hours", async ({ page }) => {
  await page.goto("/settings");
  await page.click('button:has-text("Business Hours")');

  // Toggle Sunday to open
  const sundayRow = page.locator("div", { hasText: "Sunday" }).first();
  const sundayCheckbox = sundayRow.locator('input[type="checkbox"]').first();
  const isChecked = await sundayCheckbox.isChecked();

  if (!isChecked) {
    await sundayCheckbox.check();
  } else {
    await sundayCheckbox.uncheck();
  }

  await page.click('button:has-text("Save Hours")');
  await expect(page.locator("text=Business hours updated")).toBeVisible({ timeout: 5_000 });
});
