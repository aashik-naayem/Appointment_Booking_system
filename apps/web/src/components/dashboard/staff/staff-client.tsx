"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, User, Mail, Phone, MoreHorizontal, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validations/staff";
import { cn } from "@/lib/utils/cn";
import Image from "next/image";
import type { Staff } from "@bookflow/database";
import Link from "next/link";

type StaffWithRelations = Staff & {
  services: { service: { id: string; name: string } }[];
  workingHours: { dayOfWeek: string; isWorking: boolean }[];
  _count: { appointments: number };
};

type Props = {
  initialStaff: StaffWithRelations[];
  services: { id: string; name: string }[];
  tenantId: string;
};

export function StaffClient({ initialStaff, services, tenantId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: staffList } = useQuery<StaffWithRelations[]>({
    queryKey: ["staff", tenantId],
    queryFn: async () => {
      const res = await axios.get<{ data: StaffWithRelations[] }>("/api/staff");
      return res.data.data ?? [];
    },
    initialData: initialStaff,
  });

  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { commission: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateStaffInput) => axios.post("/api/staff", data),
    onSuccess: () => {
      toast.success("Staff member added");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setShowForm(false);
      form.reset();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : "Failed";
      toast.error(msg ?? "Failed to add staff");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateStaffInput }) =>
      axios.patch(`/api/staff/${id}`, data),
    onSuccess: () => {
      toast.success("Staff updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setEditingStaff(null);
      setShowForm(false);
      form.reset();
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/staff/${id}`),
    onSuccess: () => {
      toast.success("Staff member removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setDeleteId(null);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : "Failed";
      toast.error(msg ?? "Cannot delete staff");
    },
  });

  const openEdit = (s: StaffWithRelations) => {
    setEditingStaff(s);
    form.reset({
      name: s.name,
      email: s.email,
      phone: s.phone ?? undefined,
      title: s.title ?? undefined,
      bio: s.bio ?? undefined,
      commission: Number(s.commission),
      color: s.color ?? undefined,
      serviceIds: s.services.map((ss) => ss.service.id),
    });
    setShowForm(true);
  };

  const onSubmit = (data: CreateStaffInput) => {
    if (editingStaff) updateMutation.mutate({ id: editingStaff.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Manage your team members and their schedules.</p>
        </div>
        <button
          onClick={() => {
            setEditingStaff(null);
            form.reset({ commission: 0 });
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Staff
        </button>
      </div>

      {staffList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <div className="rounded-full bg-muted p-3 mb-3">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No staff yet</p>
          <p className="text-sm text-muted-foreground">Add your first team member</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staffList.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              onEdit={() => openEdit(s)}
              onDelete={() => setDeleteId(s.id)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingStaff ? "Edit Staff" : "Add Staff Member"}
              </h2>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Name *</label>
                  <input
                    {...form.register("name")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Jane Smith"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email *</label>
                  <input
                    {...form.register("email")}
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone</label>
                  <input
                    {...form.register("phone")}
                    type="tel"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Title</label>
                  <input
                    {...form.register("title")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Senior Stylist"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Commission (%)</label>
                  <input
                    {...form.register("commission", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Calendar Color</label>
                  <input
                    {...form.register("color")}
                    type="color"
                    className="w-full h-10 rounded-md border border-input bg-background px-1 py-1 cursor-pointer"
                  />
                </div>
              </div>

              {services.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Services</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {services.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          value={svc.id}
                          {...form.register("serviceIds")}
                          className="rounded"
                        />
                        {svc.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">Bio</label>
                <textarea
                  {...form.register("bio")}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Brief bio..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingStaff(null); }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingStaff ? "Save Changes" : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-semibold">Remove Staff Member</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Staff with upcoming appointments cannot be removed.
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffCard({ staff, onEdit, onDelete }: { staff: StaffWithRelations; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const workingDays = staff.workingHours.filter((h) => h.isWorking).length;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: staff.color ?? "#6366f1" }}
          >
            {staff.avatarUrl ? (
              <Image src={staff.avatarUrl} alt={staff.name} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white font-semibold">
                {staff.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{staff.name}</h3>
            {staff.title && <p className="text-xs text-muted-foreground">{staff.title}</p>}
            <span className={cn(
              "inline-block mt-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              staff.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"
            )}>
              {staff.status}
            </span>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-1 hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 w-44 rounded-md border border-border bg-card shadow-lg py-1">
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <Link href={`/staff/${staff.id}`} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent" onClick={() => setMenuOpen(false)}>
                <Calendar className="h-3.5 w-3.5" /> Working Hours
              </Link>
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{staff.email}</span>
        </div>
        {staff.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{staff.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{staff.services.length} services</span>
        <span>{workingDays > 0 ? `${workingDays} days/week` : "Custom hours"}</span>
        <span>{staff._count.appointments} appointments</span>
      </div>
    </div>
  );
}
