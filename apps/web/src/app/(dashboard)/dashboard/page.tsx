import { requireTenant } from "@/lib/permissions";
import { prisma, AppointmentStatus } from "@bookflow/database";
import { startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { DashboardOverview } from "@/components/dashboard/overview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function getDashboardData(tenantId: string, timezone: string) {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  const todayStart = startOfDay(localNow);
  const todayEnd = endOfDay(localNow);
  const yesterdayStart = subDays(todayStart, 1);
  const weekStart = subDays(todayStart, 7);

  const [
    todayAppointments,
    upcomingAppointments,
    weekRevenue,
    weekRevenueLastWeek,
    totalCustomers,
    pendingAppointments,
  ] = await Promise.all([
    // Today's appointments
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: { notIn: [AppointmentStatus.CANCELLED] },
        deletedAt: null,
      },
      include: {
        service: { select: { name: true, duration: true, price: true } },
        staff: { select: { name: true, avatarUrl: true } },
        customer: { select: { name: true, email: true } },
      },
      orderBy: { startTime: "asc" },
    }),

    // Upcoming (next 7 days)
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: {
          gte: todayEnd,
          lte: addDays(todayEnd, 7),
        },
        status: { notIn: [AppointmentStatus.CANCELLED] },
        deletedAt: null,
      },
      include: {
        service: { select: { name: true } },
        staff: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
      take: 10,
    }),

    // This week revenue
    prisma.appointment.aggregate({
      where: {
        tenantId,
        status: AppointmentStatus.COMPLETED,
        startTime: { gte: weekStart },
      },
      _sum: { totalAmount: true },
    }),

    // Last week revenue (for comparison)
    prisma.appointment.aggregate({
      where: {
        tenantId,
        status: AppointmentStatus.COMPLETED,
        startTime: { gte: subDays(weekStart, 7), lt: weekStart },
      },
      _sum: { totalAmount: true },
    }),

    // Total customers
    prisma.customer.count({
      where: { tenantId, deletedAt: null },
    }),

    // Pending confirmations
    prisma.appointment.count({
      where: { tenantId, status: AppointmentStatus.PENDING, deletedAt: null },
    }),
  ]);

  const thisWeekRevenue = weekRevenue._sum.totalAmount?.toNumber() ?? 0;
  const lastWeekRevenue = weekRevenueLastWeek._sum.totalAmount?.toNumber() ?? 0;
  const revenueChange =
    lastWeekRevenue > 0
      ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
      : 0;

  return {
    todayAppointments,
    upcomingAppointments,
    stats: {
      todayCount: todayAppointments.length,
      weekRevenue: thisWeekRevenue,
      revenueChange,
      totalCustomers,
      pendingAppointments,
    },
  };
}

export default async function DashboardPage() {
  const ctx = await requireTenant();
  const data = await getDashboardData(ctx.tenant.id, ctx.tenant.timezone);

  return <DashboardOverview data={data} tenant={ctx.tenant} />;
}
