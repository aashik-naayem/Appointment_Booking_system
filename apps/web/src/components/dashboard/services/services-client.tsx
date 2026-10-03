"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MoreHorizontal, Clock, DollarSign, Users, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createServiceSchema, type CreateServiceInput } from "@/lib/validations/service";
import { cn } from "@/lib/utils/cn";
import type { Service, ServiceCategory } from "@bookflow/database";

type ServiceWithRelations = Service & {
  category: { id: string; name: string; color: string | null } | null;
  staff: { staff: { id: string; name: string; avatarUrl: string | null } }[];
  _count: { appointments: number };
};

type Props = {
  initialServices: ServiceWithRelations[];
  categories: ServiceCategory[];
  tenantId: string;
};

export function ServicesClient({ initialServices, categories, tenantId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithRelations | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: services } = useQuery<ServiceWithRelations[]>({
    queryKey: ["services", tenantId],
    queryFn: async () => {
      const res = await axios.get<{ data: ServiceWithRelations[] }>("/api/services");
      return res.data.data ?? [];
    },
    initialData: initialServices,
  });

  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: { duration: 60, price: 50, bufferTime: 0, isActive: true, requiresStaff: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceInput) => axios.post("/api/services", data),
    onSuccess: () => {
      toast.success("Service created");
      qc.invalidateQueries({ queryKey: ["services"] });
      setShowForm(false);
      form.reset();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : "Failed";
      toast.error(msg ?? "Failed to create service");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateServiceInput }) =>
      axios.patch(`/api/services/${id}`, data),
    onSuccess: () => {
      toast.success("Service updated");
      qc.invalidateQueries({ queryKey: ["services"] });
      setEditingService(null);
      form.reset();
    },
    onError: () => toast.error("Failed to update service"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/services/${id}`),
    onSuccess: () => {
      toast.success("Service deleted");
      qc.invalidateQueries({ queryKey: ["services"] });
      setDeleteId(null);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : "Failed";
      toast.error(msg ?? "Cannot delete service");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/services/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
    onError: () => toast.error("Failed to update"),
  });

  const onSubmit = (data: CreateServiceInput) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (service: ServiceWithRelations) => {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description ?? undefined,
      duration: service.duration,
      bufferTime: service.bufferTime,
      price: Number(service.price),
      depositAmount: service.depositAmount ? Number(service.depositAmount) : undefined,
      categoryId: service.categoryId ?? undefined,
      isActive: service.isActive,
      requiresStaff: service.requiresStaff,
    });
    setShowForm(true);
  };

  const filtered = (services ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isFormOpen = showForm || !!editingService;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground">
            Manage the services your business offers.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            form.reset({ duration: 60, price: 50, bufferTime: 0, isActive: true, requiresStaff: true });
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-sm"
        />
      </div>

      {/* Services grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No services yet</p>
          <p className="text-sm text-muted-foreground">Add your first service to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => openEdit(service)}
              onDelete={() => setDeleteId(service.id)}
              onToggle={() => toggleMutation.mutate({ id: service.id, isActive: !service.isActive })}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingService ? "Edit Service" : "Add Service"}
              </h2>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Service Name *</label>
                <input
                  {...form.register("name")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Haircut & Style"
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  {...form.register("description")}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Brief description..."
                />
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Category</label>
                  <select
                    {...form.register("categoryId")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Duration (min) *</label>
                  <input
                    {...form.register("duration", { valueAsNumber: true })}
                    type="number"
                    min="5"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {form.formState.errors.duration && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.duration.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Buffer (min)</label>
                  <input
                    {...form.register("bufferTime", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Price ($) *</label>
                  <input
                    {...form.register("price", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Deposit ($)</label>
                  <input
                    {...form.register("depositAmount", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" {...form.register("isActive")} className="rounded" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" {...form.register("requiresStaff")} className="rounded" />
                  Requires staff
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingService(null); form.reset(); }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {editingService ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-semibold">Delete Service</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone. Services with future appointments cannot be deleted.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggle,
}: {
  service: ServiceWithRelations;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn("rounded-lg border bg-card p-5 shadow-sm transition-opacity", !service.isActive && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {service.category && (
            <span
              className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: service.category.color ?? "#6366f1" }}
            >
              {service.category.name}
            </span>
          )}
          <h3 className="font-semibold truncate">{service.name}</h3>
          {service.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{service.description}</p>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-1 hover:bg-accent transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 w-40 rounded-md border border-border bg-card shadow-lg py-1">
              <button
                onClick={() => { onEdit(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => { onToggle(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                {service.isActive ? (
                  <><ToggleLeft className="h-3.5 w-3.5" /> Deactivate</>
                ) : (
                  <><ToggleRight className="h-3.5 w-3.5" /> Activate</>
                )}
              </button>
              <button
                onClick={() => { onDelete(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {service.duration}m
        </span>
        {service.bufferTime > 0 && (
          <span className="text-xs">+{service.bufferTime}m buffer</span>
        )}
        <span className="flex items-center gap-1 font-medium text-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          {Number(service.price).toFixed(2)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {service.staff.length} staff · {service._count.appointments} appts
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            service.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {service.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
