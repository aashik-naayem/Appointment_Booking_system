/**
 * API response utilities and consistent error handling
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, TenantAccessError, NotFoundError, ForbiddenError } from "@/lib/permissions";

export type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

export function apiSuccess<T>(data: T, status = 200, meta?: ApiResponse["meta"]) {
  return NextResponse.json<ApiResponse<T>>({ data, meta }, { status });
}

export function apiCreated<T>(data: T) {
  return NextResponse.json<ApiResponse<T>>({ data }, { status: 201 });
}

export function apiError(message: string, status = 500) {
  return NextResponse.json<ApiResponse>({ error: message }, { status });
}

export function apiValidationError(errors: Record<string, string[]>) {
  return NextResponse.json<ApiResponse>({ error: "Validation failed", errors }, { status: 422 });
}

/**
 * Standardized error handler for API route handlers.
 * Maps internal errors to appropriate HTTP responses.
 * Never exposes internal error details in production.
 */
export function handleApiError(error: unknown): NextResponse {
  // requireAuth()/requireTenant() call Next's redirect(), which works by throwing.
  // In a route handler that must become a proper 401/403 JSON response, not a 500.
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
    return digest.includes("/auth/login")
      ? apiError("Unauthorized", 401)
      : apiError("Business setup required", 403);
  }

  console.error("[API Error]:", error);

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path]!.push(err.message);
    });
    return apiValidationError(fieldErrors);
  }

  if (error instanceof AuthError) {
    return apiError("Unauthorized", 401);
  }

  if (error instanceof ForbiddenError || error instanceof TenantAccessError) {
    return apiError("Forbidden", 403);
  }

  if (error instanceof NotFoundError) {
    return apiError("Not found", 404);
  }

  if (error instanceof Error) {
    // Known business logic errors (safe to expose)
    const safeErrors = [
      "Time slot was just booked",
      "Selected time slot is no longer available",
      "Selected time slot is not available",
      "Service not found",
      "Booking limit reached",
      "Booking is not available at this time",
      "Cannot reschedule",
      "Cannot cancel",
      "Staff member not found",
      "This staff member cannot perform",
      "Appointment not found",
    ];

    const isSafe = safeErrors.some((msg) => error.message.includes(msg));
    if (isSafe) {
      return apiError(error.message, 400);
    }
  }

  // Generic error — don't leak internals
  return apiError("An unexpected error occurred", 500);
}

// ============================================================
// PAGINATION
// ============================================================

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  return { page, pageSize };
}

export function getPaginationMeta(total: number, page: number, pageSize: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
