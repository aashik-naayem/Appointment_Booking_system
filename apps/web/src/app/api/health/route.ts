import { NextResponse } from "next/server";
import { prisma } from "@bookflow/database";

export async function GET() {
  try {
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env["npm_package_version"] ?? "unknown",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database unavailable" },
      { status: 503 },
    );
  }
}
