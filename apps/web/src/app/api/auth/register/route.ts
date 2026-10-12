import { type NextRequest } from "next/server";
import { apiCreated, apiError, handleApiError } from "@/lib/utils/api";
import { prisma } from "@bookflow/database";
import { registerBaseSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@bookflow/database";
import { checkAuthRateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateLimit = await checkAuthRateLimit(request);
    if (!rateLimit.success) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as unknown;
    const { name, email, password } = registerBaseSchema
      .omit({ confirmPassword: true })
      .parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return apiError("An account with this email already exists", 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "STAFF", // Will be upgraded to OWNER after tenant creation
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return apiCreated({ user });
  } catch (error) {
    // Two simultaneous sign-ups with the same email: the unique index wins.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("An account with this email already exists", 409);
    }
    return handleApiError(error);
  }
}
