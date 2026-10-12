/**
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { createBookingSchema } from "@/lib/validations/booking";
import { createServiceSchema } from "@/lib/validations/service";
import { createTenantSchema } from "@/lib/validations/tenant";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = loginSchema.safeParse({ email: "TEST@EXAMPLE.COM", password: "secret" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("test@example.com");
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Jane Smith",
    email: "jane@example.com",
    password: "SecurePass1",
    confirmPassword: "SecurePass1",
  };

  it("accepts valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short name", () => {
    expect(registerSchema.safeParse({ ...valid, name: "J" }).success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "securepass1",
      confirmPassword: "securepass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "SecurePass!",
      confirmPassword: "SecurePass!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.errors.map((e) => e.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });

  it("rejects password under 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Ab1", confirmPassword: "Ab1" });
    expect(result.success).toBe(false);
  });
});

describe("createBookingSchema", () => {
  const valid = {
    serviceId: "clxxxxxxxxxxxxxxxxxxxxxx",
    startTime: new Date(Date.now() + 86400000).toISOString(),
    customerName: "John Doe",
    customerEmail: "john@example.com",
    timezone: "America/New_York",
  };

  it("accepts valid booking", () => {
    expect(createBookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid service ID", () => {
    expect(createBookingSchema.safeParse({ ...valid, serviceId: "not-a-cuid" }).success).toBe(
      false,
    );
  });

  it("rejects invalid email", () => {
    expect(createBookingSchema.safeParse({ ...valid, customerEmail: "not-email" }).success).toBe(
      false,
    );
  });

  it("rejects invalid ISO datetime", () => {
    expect(createBookingSchema.safeParse({ ...valid, startTime: "not-a-date" }).success).toBe(
      false,
    );
  });

  it("rejects notes over 500 chars", () => {
    const result = createBookingSchema.safeParse({
      ...valid,
      customerNotes: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("createServiceSchema", () => {
  const valid = {
    name: "Haircut",
    duration: 60,
    price: 50,
    bufferTime: 0,
    isActive: true,
    requiresStaff: true,
  };

  it("accepts valid service", () => {
    expect(createServiceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects duration below 5 minutes", () => {
    expect(createServiceSchema.safeParse({ ...valid, duration: 4 }).success).toBe(false);
  });

  it("rejects duration above 8 hours", () => {
    expect(createServiceSchema.safeParse({ ...valid, duration: 481 }).success).toBe(false);
  });

  it("rejects negative price", () => {
    expect(createServiceSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
  });

  it("accepts free services (price = 0)", () => {
    expect(createServiceSchema.safeParse({ ...valid, price: 0 }).success).toBe(true);
  });
});

describe("createTenantSchema", () => {
  const valid = {
    name: "Jane's Salon",
    slug: "janes-salon",
    timezone: "America/New_York",
    currency: "USD",
    country: "US",
  };

  it("accepts valid tenant", () => {
    expect(createTenantSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects slug with uppercase", () => {
    expect(createTenantSchema.safeParse({ ...valid, slug: "Janes-Salon" }).success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    expect(createTenantSchema.safeParse({ ...valid, slug: "jane salon" }).success).toBe(false);
  });

  it("rejects short name", () => {
    expect(createTenantSchema.safeParse({ ...valid, name: "J" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(createTenantSchema.safeParse({ ...valid, email: "bad-email" }).success).toBe(false);
  });
});
