import { type Page, expect } from "@playwright/test";
import { format, addDays } from "date-fns";

export const TEST_USER = {
  name: "E2E Test User",
  email: `e2e-${Date.now()}@bookflow-test.com`,
  password: "TestPass123",
};

export const TEST_BUSINESS = {
  name: "E2E Test Salon",
  description: "End-to-end test business",
};

export const TEST_SERVICE = {
  name: "E2E Haircut",
  duration: 30,
  price: 40,
};

export const TEST_STAFF = {
  name: "E2E Staff Member",
  email: `e2e-staff-${Date.now()}@bookflow-test.com`,
};

export async function registerUser(page: Page, user = TEST_USER) {
  await page.goto("/auth/register");
  await page.fill('[placeholder="Jane Smith"]', user.name);
  await page.fill('[placeholder="you@example.com"]', user.email);
  await page.fill('[placeholder="Min 8 characters"]', user.password);
  await page.fill('[placeholder="••••••••"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/onboarding", { timeout: 15_000 });
}

export async function loginUser(page: Page, user = TEST_USER) {
  await page.goto("/auth/login");
  await page.fill('[placeholder="you@example.com"]', user.email);
  await page.fill('[placeholder="••••••••"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard", { timeout: 15_000 });
}

export async function completOnboarding(page: Page, business = TEST_BUSINESS) {
  await page.waitForURL("/onboarding", { timeout: 10_000 });

  // Step 1: Business
  await page.fill('[placeholder="Jane\'s Hair Salon"]', business.name);
  await page.fill('[placeholder="Brief description of your business..."]', business.description);
  await page.click('button[type="submit"]');

  // Step 2: Service — skip
  await page.click('button:text("Skip")');

  // Step 3: Staff — skip
  await page.click('button:text("Skip")');

  // Done
  await page.click('button:text("Go to Dashboard")');
  await page.waitForURL("/dashboard", { timeout: 15_000 });
}

export async function createService(page: Page, service = TEST_SERVICE) {
  await page.goto("/services");
  await page.click('button:text("Add Service")');
  await page.fill('[placeholder="Haircut & Style"]', service.name);
  await page.fill('input[type="number"]:near(:text("Duration"))', String(service.duration));
  await page.fill('input[type="number"]:near(:text("Price"))', String(service.price));
  await page.click('button:text("Create Service")');
  await expect(page.locator(`text=${service.name}`)).toBeVisible({ timeout: 5_000 });
}

export async function getNextAvailableDate(): Promise<string> {
  // Get tomorrow's date as YYYY-MM-DD
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}
