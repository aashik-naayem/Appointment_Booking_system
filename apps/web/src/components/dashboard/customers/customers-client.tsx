"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  Users,
  Mail,
  Phone,
  Star,
  ShieldOff,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { format } from "date-fns";
import type { Customer, CustomerStatus } from "@bookflow/database";

type CustomerWithCount = Customer & { _count: { appointments: number } };

type ApiResponse = {
  data: CustomerWithCount[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_BADGES: Record<CustomerStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  BLACKLISTED: {
    label: "Blacklisted",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  VIP: {
    label: "VIP",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
};

export function CustomersClient({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debounce = useCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(1);
  }, []);

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["customers", tenantId, debouncedSearch, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await axios.get<ApiResponse>(`/api/customers?${params.toString()}`);
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: CustomerStatus } }) =>
      axios.patch(`/api/customers/${id}`, data),
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("Failed to update customer"),
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          View and manage all your customers.
          {meta && <span className="ml-1 text-sm">({meta.total} total)</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debounce(e.target.value);
            }}
            placeholder="Search customers..."
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border py-2 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="VIP">VIP</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
      </div>

      {/* Table */}
      <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
        {isLoading ? (
          <div className="divide-border space-y-0 divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-48 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="text-muted-foreground/40 h-10 w-10" />
            <p className="text-muted-foreground mt-3 text-sm">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/40 border-b">
                  <th className="text-muted-foreground px-6 py-3 text-left font-medium">
                    Customer
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Contact</th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                    Bookings
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                    Total Spent
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                    Last Visit
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {customers.map((c) => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    onStatusChange={(status) =>
                      updateMutation.mutate({ id: c.id, data: { status } })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-border hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="border-border hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  onStatusChange,
}: {
  customer: CustomerWithCount;
  onStatusChange: (status: CustomerStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const badge = STATUS_BADGES[customer.status];

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-6 py-4">
        <Link
          href={`/customers/${customer.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {customer.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{customer.name}</p>
            {customer.noShowCount > 0 && (
              <p className="text-xs text-amber-600">
                {customer.noShowCount} no-show{customer.noShowCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </Link>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-0.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" /> {customer.email}
          </p>
          {customer.phone && (
            <p className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {customer.phone}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <span className="font-medium">{customer._count.appointments}</span>
        <span className="text-muted-foreground"> / {customer.completedBookings} completed</span>
      </td>
      <td className="px-4 py-4 font-medium">${Number(customer.totalSpent).toFixed(2)}</td>
      <td className="text-muted-foreground px-4 py-4 text-xs">
        {customer.lastVisitAt ? format(new Date(customer.lastVisitAt), "MMM d, yyyy") : "—"}
      </td>
      <td className="px-4 py-4">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
          {badge.label}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="hover:bg-accent rounded-md p-1">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="border-border bg-card absolute right-0 top-7 z-10 w-44 rounded-md border py-1 shadow-lg">
              <Link
                href={`/customers/${customer.id}`}
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                onClick={() => setMenuOpen(false)}
              >
                View Profile
              </Link>
              {customer.status !== "VIP" && (
                <button
                  onClick={() => {
                    onStatusChange("VIP");
                    setMenuOpen(false);
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Mark VIP
                </button>
              )}
              {customer.status !== "ACTIVE" && (
                <button
                  onClick={() => {
                    onStatusChange("ACTIVE");
                    setMenuOpen(false);
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                >
                  Set Active
                </button>
              )}
              {customer.status !== "BLACKLISTED" && (
                <button
                  onClick={() => {
                    onStatusChange("BLACKLISTED");
                    setMenuOpen(false);
                  }}
                  className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Blacklist
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
