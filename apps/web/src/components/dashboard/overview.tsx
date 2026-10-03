"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import type { Tenant, AppointmentStatus } from "@bookflow/database";
import {
  CalendarCheck2,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

type Appointment = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  service: { name: string; duration: number; price: { toNumber: () => number } };
  staff: { name: string; avatarUrl: string | null } | null;
  customer: { name: string; email: string };
};

type Props = {
  data: {
    todayAppointments: Appointment[];
    upcomingAppointments: Appointment[];
    stats: {
      todayCount: number;
      weekRevenue: number;
      revenueChange: number;
      totalCustomers: number;
      pendingAppointments: number;
    };
  };
  tenant: Tenant;
};

export function DashboardOverview({ data, tenant }: Props) {
  const { stats, todayAppointments, upcomingAppointments } = data;

  const statCards = [
    {
      label: "Today's Appointments",
      value: stats.todayCount,
      icon: CalendarCheck2,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Weekly Revenue",
      value: `$${stats.weekRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
      change: stats.revenueChange,
    },
    {
      label: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Pending Confirmations",
      value: stats.pendingAppointments,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening at {tenant.name}.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold">{card.value}</p>
                  {card.change !== undefined && (
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1 text-xs font-medium",
                        card.change >= 0 ? "text-green-600" : "text-red-600",
                      )}
                    >
                      {card.change >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(card.change).toFixed(1)}% from last week
                    </p>
                  )}
                </div>
                <div className={cn("rounded-md p-2.5", card.bg)}>
                  <Icon className={cn("h-5 w-5", card.color)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's appointments */}
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Today&apos;s Appointments</h2>
            <Link
              href="/appointments"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarCheck2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No appointments today
                </p>
              </div>
            ) : (
              todayAppointments.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} timezone={tenant.timezone} />
              ))
            )}
          </div>
        </div>

        {/* Upcoming appointments */}
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Upcoming (Next 7 Days)</h2>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {upcomingAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No upcoming appointments
                </p>
              </div>
            ) : (
              upcomingAppointments.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} timezone={tenant.timezone} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentRow({
  appointment,
  timezone,
}: {
  appointment: {
    id: string;
    startTime: Date;
    status: AppointmentStatus;
    service: { name: string };
    staff: { name: string } | null;
    customer: { name: string };
  };
  timezone: string;
}) {
  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex-shrink-0 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {format(new Date(appointment.startTime), "MMM")}
        </p>
        <p className="text-xl font-bold leading-tight">
          {format(new Date(appointment.startTime), "d")}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(appointment.startTime), "HH:mm")}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{appointment.customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {appointment.service.name}
          {appointment.staff && ` • ${appointment.staff.name}`}
        </p>
      </div>

      <StatusBadge status={appointment.status} />
    </Link>
  );
}
