"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, CalendarCheck2, XCircle, UserX, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";

type AnalyticsData = {
  overview: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShows: number;
    revenue: number;
    completionRate: number;
    cancellationRate: number;
    returningCustomers: number;
  };
  topServices: { serviceId: string; serviceName: string; bookingCount: number; revenue: number }[];
  topStaff: { staffId: string | null; staffName: string; completedBookings: number; revenue: number }[];
  bookingsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; revenue: number }[];
  peakHours: { hour: number; count: number }[];
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export function AnalyticsClient({ tenantId, currency }: { tenantId: string; currency: string }) {
  const [period, setPeriod] = useState("30d");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", tenantId, period],
    queryFn: async () => {
      const res = await axios.get<{ data: AnalyticsData }>(`/api/analytics?period=${period}`);
      return res.data.data!;
    },
  });

  const periodOptions = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "12m", label: "12 months" },
  ];

  const statCards = data
    ? [
        { label: "Total Bookings", value: data.overview.totalBookings, icon: CalendarCheck2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
        { label: "Completed", value: data.overview.completedBookings, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
        { label: "Cancelled", value: data.overview.cancelledBookings, icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
        { label: "No-Shows", value: data.overview.noShows, icon: UserX, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
        { label: "Revenue", value: `${currency} ${data.overview.revenue.toFixed(2)}`, icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950" },
        { label: "Returning Customers", value: data.overview.returningCustomers, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950" },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Business performance insights.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`rounded-md p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rate indicators */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Completion Rate</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{data.overview.completionRate.toFixed(1)}%</p>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${data.overview.completionRate}%` }} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Cancellation Rate</p>
            <p className="mt-1 text-3xl font-bold text-red-500">{data.overview.cancellationRate.toFixed(1)}%</p>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${data.overview.cancellationRate}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Bookings over time */}
      {data && data.bookingsByDay.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Bookings Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.bookingsByDay}>
              <defs>
                <linearGradient id="bookingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => format(new Date(v), "MMM d")}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(v: string) => format(new Date(v), "MMM d, yyyy")}
                formatter={(v: number) => [v, "Bookings"]}
              />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#bookingGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue over time */}
      {data && data.revenueByDay.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Revenue Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.revenueByDay}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => format(new Date(v), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip labelFormatter={(v: string) => format(new Date(v), "MMM d, yyyy")} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Services */}
        {data && data.topServices.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">Top Services</h2>
            <div className="space-y-3">
              {data.topServices.map((s, i) => (
                <div key={s.serviceId} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ backgroundColor: COLORS[i] ?? "#6366f1" }}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.serviceName}</p>
                    <p className="text-xs text-muted-foreground">{s.bookingCount} bookings</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">${s.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Staff */}
        {data && data.topStaff.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">Staff Performance</h2>
            <div className="space-y-3">
              {data.topStaff.map((s, i) => (
                <div key={s.staffId ?? "unassigned"} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.staffName}</p>
                    <p className="text-xs text-muted-foreground">{s.completedBookings} completed</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">${s.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peak hours */}
        {data && data.peakHours.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">Peak Booking Hours</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.peakHours.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h: number) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "Bookings"]} labelFormatter={(h: number) => `${h}:00`} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
