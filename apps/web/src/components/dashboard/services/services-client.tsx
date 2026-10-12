"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Clock,
  DollarSign,
  Users,
  Search,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createServiceSchema, type CreateServiceInput } from "@/lib/validations/service";
import { cn } from "@/lib/utils/cn";
import type { Service, ServiceCategory } from "@bookflow/database";
import type { Serialized } from "@/lib/utils/serialize";

type ServiceWithRelations = Serialized<Service> & {
  category: { id: string; name: string; color: string | null } | null;
  staff: { staff: { id: string; name: string; avatarUrl: string | null } }[];
  _count: { appointments: number };
};

type Props = {
  initialServices: ServiceWithRelations[];
  categories: Serialized<ServiceCategory>[];
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
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : "Failed";
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
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : "Failed";
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
          <p className="text-muted-foreground">Manage the services your business offers.</p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            form.reset({
              duration: 60,
              price: 50,
              bufferTime: 0,
              isActive: true,
              requiresStaff: true,
            });
            setShowForm(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="border-input bg-background focus-visible:ring-ring w-full max-w-sm rounded-md border py-2 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>

      {/* Services grid */}
      {filtered.length === 0 ? (
        <div className="border-border flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Plus className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No services yet</p>
          <p className="text-muted-foreground text-sm">Add your first service to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => openEdit(service)}
              onDelete={() => setDeleteId(service.id)}
              onToggle={() =>
                toggleMutation.mutate({ id: service.id, isActive: !service.isActive })
              }
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="border-border bg-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border shadow-xl">
            <div className="border-border border-b px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingService ? "Edit Service" : "Add Service"}
              </h2>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Service Name *</label>
                <input
                  {...form.register("name")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  placeholder="Haircut & Style"
                />
                {form.formState.errors.name && (
                  <p className="text-destructive mt-1 text-xs">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  {...form.register("description")}
                  rows={2}
                  className="border-input bg-background focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  placeholder="Brief description..."
                />
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Category</label>
                  <select
                    {...form.register("categoryId")}
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
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
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  />
                  {form.formState.errors.duration && (
                    <p className="text-destructive mt-1 text-xs">
                      {form.formState.errors.duration.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Buffer (min)</label>
                  <input
                    {...form.register("bufferTime", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
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
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
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
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...form.register("isActive")} className="rounded" />
                  Active
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...form.register("requiresStaff")} className="rounded" />
                  Requires staff
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingService(null);
                    form.reset();
                  }}
                  className="border-border hover:bg-accent flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-xl">
            <h3 className="font-semibold">Delete Service</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              This action cannot be undone. Services with future appointments cannot be deleted.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="border-border hover:bg-accent flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
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
    <div
      className={cn(
        "bg-card rounded-lg border p-5 shadow-sm transition-opacity",
        !service.isActive && "opacity-60",
      )}
    >
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
          <h3 className="truncate font-semibold">{service.name}</h3>
          {service.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {service.description}
            </p>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="hover:bg-accent rounded-md p-1 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="border-border bg-card absolute right-0 top-7 z-10 w-40 rounded-md border py-1 shadow-lg">
              <button
                onClick={() => {
                  onEdit();
                  setMenuOpen(false);
                }}
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-sm"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  onToggle();
                  setMenuOpen(false);
                }}
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-sm"
              >
                {service.isActive ? (
                  <>
                    <ToggleLeft className="h-3.5 w-3.5" /> Deactivate
                  </>
                ) : (
                  <>
                    <ToggleRight className="h-3.5 w-3.5" /> Activate
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-1.5 text-sm"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-muted-foreground mt-4 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {service.duration}m
        </span>
        {service.bufferTime > 0 && <span className="text-xs">+{service.bufferTime}m buffer</span>}
        <span className="text-foreground flex items-center gap-1 font-medium">
          <DollarSign className="h-3.5 w-3.5" />
          {Number(service.price).toFixed(2)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
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
