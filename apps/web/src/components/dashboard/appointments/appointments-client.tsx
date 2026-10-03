"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import type { AppointmentStatus } from "@bookflow/database";

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  bookingReference: string;
  servicePrice: string;
  totalAmount: string;
  service: { name: string; duration: number };
  staff: { name: string; avatarUrl: string | null } | null;
  customer: { name: string; email: string; phone: string | null };
  payment: { status: string; amount: string } | null;
};

type ApiResponse = {
  data: Appointment[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-Show" },
];

export function AppointmentsClient({ tenantId, timezone }: { tenantId: string; timezone: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["appointments", tenantId, search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await axios.get<ApiResponse>(`/api/appointments?${params.toString()}`);
      return res.data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) =>
      axios.patch(`/api/appointments/${id}`, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(`Appointment ${vars.action === "complete" ? "completed" : vars.action === "cancel" ? "cancelled" : "updated"}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setActionMenu(null);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : "Action failed";
      toast.error(msg ?? "Action failed");
    },
  });

  const appointments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground">
          Manage all appointments.
          {meta && <span className="ml-1">({meta.total} total)</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by customer or reference..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Clock className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No appointments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Date/Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Staff</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium">{format(new Date(apt.startTime), "MMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(apt.startTime), "HH:mm")} · {apt.service.duration}m</p>
                      <p className="text-xs font-mono text-muted-foreground/60">#{apt.bookingReference.slice(-8).toUpperCase()}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{apt.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{apt.customer.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{apt.service.name}</p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {apt.staff?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      ${Number(apt.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenu(actionMenu === apt.id ? null : apt.id)}
                          className="rounded-md p-1 hover:bg-accent"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {actionMenu === apt.id && (
                          <div className="absolute right-0 top-7 z-10 w-44 rounded-md border border-border bg-card shadow-lg py-1">
                            <Link
                              href={`/appointments/${apt.id}`}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              onClick={() => setActionMenu(null)}
                            >
                              View Details
                            </Link>
                            {apt.status === "PENDING" && (
                              <button
                                onClick={() => actionMutation.mutate({ id: apt.id, action: "confirm" })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" /> Confirm
                              </button>
                            )}
                            {["CONFIRMED", "IN_PROGRESS"].includes(apt.status) && (
                              <button
                                onClick={() => actionMutation.mutate({ id: apt.id, action: "complete" })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" /> Complete
                              </button>
                            )}
                            {["PENDING", "CONFIRMED"].includes(apt.status) && (
                              <button
                                onClick={() => actionMutation.mutate({ id: apt.id, action: "no-show" })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              >
                                <XCircle className="h-3.5 w-3.5 text-amber-600" /> Mark No-Show
                              </button>
                            )}
                            {!["CANCELLED", "COMPLETED"].includes(apt.status) && (
                              <button
                                onClick={() => actionMutation.mutate({ id: apt.id, action: "cancel" })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">{page} / {meta.totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === meta.totalPages} className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
