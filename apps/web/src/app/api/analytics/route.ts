import { type NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/utils/api";
import { requireTenant } from "@/lib/permissions";
import { prisma, AppointmentStatus } from "@bookflow/database";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { getCached } from "@/lib/db/redis";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenant();
    const { searchParams } = request.nextUrl;
    const period = searchParams.get("period") ?? "30d";
    const tenantId = ctx.tenant.id;

    // Parse period
    const now = new Date();
    let dateFrom: Date;
    switch (period) {
      case "7d":
        dateFrom = subDays(now, 7);
        break;
      case "30d":
        dateFrom = subDays(now, 30);
        break;
      case "90d":
        dateFrom = subDays(now, 90);
        break;
      case "12m":
        dateFrom = subMonths(now, 12);
        break;
      default:
        dateFrom = subDays(now, 30);
    }

    const cacheKey = `analytics:${tenantId}:${period}`;

    const analytics = await getCached(
      cacheKey,
      async () => {
        const [
          totalBookings,
          completedBookings,
          cancelledBookings,
          noShows,
          revenueResult,
          topServices,
          topStaff,
          bookingsByDay,
          revenueByDay,
          peakHours,
          returningCustomers,
        ] = await Promise.all([
          // Total bookings
          prisma.appointment.count({
            where: { tenantId, startTime: { gte: dateFrom }, deletedAt: null },
          }),

          // Completed
          prisma.appointment.count({
            where: {
              tenantId,
              status: AppointmentStatus.COMPLETED,
              startTime: { gte: dateFrom },
            },
          }),

          // Cancelled
          prisma.appointment.count({
            where: {
              tenantId,
              status: AppointmentStatus.CANCELLED,
              startTime: { gte: dateFrom },
            },
          }),

          // No shows
          prisma.appointment.count({
            where: {
              tenantId,
              status: AppointmentStatus.NO_SHOW,
              startTime: { gte: dateFrom },
            },
          }),

          // Revenue
          prisma.appointment.aggregate({
            where: {
              tenantId,
              status: AppointmentStatus.COMPLETED,
              startTime: { gte: dateFrom },
            },
            _sum: { totalAmount: true },
          }),

          // Top services
          prisma.appointment.groupBy({
            by: ["serviceId"],
            where: { tenantId, startTime: { gte: dateFrom }, deletedAt: null },
            _count: { serviceId: true },
            _sum: { totalAmount: true },
            orderBy: { _count: { serviceId: "desc" } },
            take: 5,
          }),

          // Top staff
          prisma.appointment.groupBy({
            by: ["staffId"],
            where: {
              tenantId,
              status: AppointmentStatus.COMPLETED,
              startTime: { gte: dateFrom },
              staffId: { not: null },
            },
            _count: { staffId: true },
            _sum: { totalAmount: true },
            orderBy: { _count: { staffId: "desc" } },
            take: 5,
          }),

          // Bookings over time (raw SQL for grouping by day)
          prisma.$queryRaw<{ date: string; count: number }[]>`
            SELECT 
              DATE_TRUNC('day', "startTime") as date,
              COUNT(*)::int as count
            FROM "Appointment"
            WHERE "tenantId" = ${tenantId}
              AND "startTime" >= ${dateFrom}
              AND "deletedAt" IS NULL
            GROUP BY DATE_TRUNC('day', "startTime")
            ORDER BY date ASC
          `,

          // Revenue over time
          prisma.$queryRaw<{ date: string; revenue: number }[]>`
            SELECT 
              DATE_TRUNC('day', "startTime") as date,
              SUM("totalAmount")::float as revenue
            FROM "Appointment"
            WHERE "tenantId" = ${tenantId}
              AND status = 'COMPLETED'
              AND "startTime" >= ${dateFrom}
            GROUP BY DATE_TRUNC('day', "startTime")
            ORDER BY date ASC
          `,

          // Peak booking hours
          prisma.$queryRaw<{ hour: number; count: number }[]>`
            SELECT 
              EXTRACT(HOUR FROM "startTime")::int as hour,
              COUNT(*)::int as count
            FROM "Appointment"
            WHERE "tenantId" = ${tenantId}
              AND "startTime" >= ${dateFrom}
              AND "deletedAt" IS NULL
            GROUP BY EXTRACT(HOUR FROM "startTime")
            ORDER BY count DESC
          `,

          // Returning customers
          prisma.customer.count({
            where: {
              tenantId,
              completedBookings: { gte: 2 },
            },
          }),
        ]);

        // Enrich top services with names
        const serviceIds = topServices.map((s) => s.serviceId);
        const services = await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        });
        const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));

        // Enrich top staff with names
        const staffIds = topStaff.map((s) => s.staffId).filter(Boolean) as string[];
        const staffMembers = await prisma.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true, avatarUrl: true },
        });
        const staffMap = Object.fromEntries(staffMembers.map((s) => [s.id, s]));

        return {
          overview: {
            totalBookings,
            completedBookings,
            cancelledBookings,
            noShows,
            revenue: revenueResult._sum.totalAmount?.toNumber() ?? 0,
            completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
            cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
            returningCustomers,
          },
          topServices: topServices.map((s) => ({
            serviceId: s.serviceId,
            serviceName: serviceMap[s.serviceId] ?? "Unknown",
            bookingCount: s._count.serviceId,
            revenue: Number(s._sum.totalAmount) ?? 0,
          })),
          topStaff: topStaff.map((s) => ({
            staffId: s.staffId,
            staffName: s.staffId ? staffMap[s.staffId]?.name ?? "Unknown" : "Unassigned",
            avatarUrl: s.staffId ? staffMap[s.staffId]?.avatarUrl ?? null : null,
            completedBookings: s._count.staffId,
            revenue: Number(s._sum.totalAmount) ?? 0,
          })),
          bookingsByDay,
          revenueByDay,
          peakHours,
        };
      },
      300, // 5 minute cache
    );

    return apiSuccess(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
