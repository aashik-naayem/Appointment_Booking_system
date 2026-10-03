"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { updateTenantSchema, type UpdateTenantInput } from "@/lib/validations/tenant";
import type { Tenant, BusinessHours, Holiday } from "@bookflow/database";
import { Save, Trash2, Plus, Globe, Clock, Palette } from "lucide-react";
import { format } from "date-fns";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday",
};

const TIMEZONES = Intl.supportedValuesOf("timeZone");

type Props = { tenant: Tenant; businessHours: BusinessHours[]; holidays: Holiday[] };

export function SettingsClient({ tenant, businessHours: initialHours, holidays: initialHolidays }: Props) {
  const [activeTab, setActiveTab] = useState<"general" | "hours" | "branding" | "notifications">("general");
  const [hours, setHours] = useState(initialHours);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  const form = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema),
    defaultValues: {
      name: tenant.name,
      description: tenant.description ?? "",
      email: tenant.email ?? "",
      phone: tenant.phone ?? "",
      address: tenant.address ?? "",
      city: tenant.city ?? "",
      state: tenant.state ?? "",
      country: tenant.country,
      postalCode: tenant.postalCode ?? "",
      timezone: tenant.timezone,
      currency: tenant.currency,
      bookingLeadTime: tenant.bookingLeadTime,
      bookingWindowDays: tenant.bookingWindowDays,
      cancellationHours: tenant.cancellationHours,
      autoConfirm: tenant.autoConfirm,
      allowGuestBooking: tenant.allowGuestBooking,
      requireDeposit: tenant.requireDeposit,
      primaryColor: tenant.primaryColor,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTenantInput) => axios.patch("/api/tenants", data),
    onSuccess: () => toast.success("Settings saved"),
    onError: () => toast.error("Failed to save settings"),
  });

  const hoursMutation = useMutation({
    mutationFn: (data: typeof hours) =>
      axios.put("/api/tenants/business-hours", { businessHours: data }),
    onSuccess: () => toast.success("Business hours updated"),
    onError: () => toast.error("Failed to update hours"),
  });

  const addHolidayMutation = useMutation({
    mutationFn: (data: { name: string; date: string }) =>
      axios.post<{ data: Holiday }>("/api/tenants/holidays", data),
    onSuccess: (res) => {
      setHolidays((prev) => [...prev, res.data.data]);
      setNewHolidayName("");
      setNewHolidayDate("");
      toast.success("Holiday added");
    },
    onError: () => toast.error("Failed to add holiday"),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/tenants/holidays?id=${id}`),
    onSuccess: (_, id) => {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success("Holiday removed");
    },
    onError: () => toast.error("Failed to remove holiday"),
  });

  const tabs = [
    { id: "general" as const, label: "General", icon: Globe },
    { id: "hours" as const, label: "Business Hours", icon: Clock },
    { id: "branding" as const, label: "Branding", icon: Palette },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your business settings.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* General Settings */}
      {activeTab === "general" && (
        <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold">Business Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Business Name</label>
                <input {...form.register("name")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea {...form.register("description")} rows={2} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <input {...form.register("email")} type="email" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone</label>
                <input {...form.register("phone")} type="tel" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input {...form.register("address")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">City</label>
                <input {...form.register("city")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">State</label>
                <input {...form.register("state")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold">Booking Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Timezone</label>
                <select {...form.register("timezone")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Currency</label>
                <select {...form.register("currency")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Booking Lead Time (min)</label>
                <input {...form.register("bookingLeadTime", { valueAsNumber: true })} type="number" min="0" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <p className="mt-1 text-xs text-muted-foreground">Min time before booking can be made</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Booking Window (days)</label>
                <input {...form.register("bookingWindowDays", { valueAsNumber: true })} type="number" min="1" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cancellation Notice (hours)</label>
                <input {...form.register("cancellationHours", { valueAsNumber: true })} type="number" min="0" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register("autoConfirm")} className="rounded" />
                <span className="font-medium">Auto-confirm bookings</span>
                <span className="text-muted-foreground">(skip manual confirmation)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register("allowGuestBooking")} className="rounded" />
                <span className="font-medium">Allow guest bookings</span>
                <span className="text-muted-foreground">(no account required)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register("requireDeposit")} className="rounded" />
                <span className="font-medium">Require deposit</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}

      {/* Business Hours */}
      {activeTab === "hours" && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Business Hours</h2>
            <div className="space-y-3">
              {hours.map((h, idx) => (
                <div key={h.dayOfWeek} className="flex items-center gap-4">
                  <div className="w-28">
                    <span className="text-sm font-medium">{DAY_LABELS[h.dayOfWeek]}</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={h.isOpen}
                      onChange={(e) => setHours(prev => prev.map((p, i) => i === idx ? { ...p, isOpen: e.target.checked } : p))}
                      className="rounded"
                    />
                    Open
                  </label>
                  {h.isOpen && (
                    <>
                      <input
                        type="time"
                        value={h.startTime}
                        onChange={(e) => setHours(prev => prev.map((p, i) => i === idx ? { ...p, startTime: e.target.value } : p))}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <input
                        type="time"
                        value={h.endTime}
                        onChange={(e) => setHours(prev => prev.map((p, i) => i === idx ? { ...p, endTime: e.target.value } : p))}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </>
                  )}
                  {!h.isOpen && <span className="text-sm text-muted-foreground">Closed</span>}
                </div>
              ))}
            </div>
            <button
              onClick={() => hoursMutation.mutate(hours)}
              disabled={hoursMutation.isPending}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {hoursMutation.isPending ? "Saving..." : "Save Hours"}
            </button>
          </div>

          {/* Holidays */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Holidays & Closures</h2>
            <div className="space-y-2 mb-4">
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holidays configured.</p>
              ) : (
                holidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.date), "MMMM d, yyyy")}
                        {h.recurring && " · Annual"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteHolidayMutation.mutate(h.id)}
                      className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="Holiday name"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                type="date"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                onClick={() => {
                  if (newHolidayName && newHolidayDate) {
                    addHolidayMutation.mutate({ name: newHolidayName, date: newHolidayDate });
                  }
                }}
                disabled={!newHolidayName || !newHolidayDate || addHolidayMutation.isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branding */}
      {activeTab === "branding" && (
        <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold">Brand Colors</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Primary Color</label>
                <div className="flex gap-2">
                  <input {...form.register("primaryColor")} type="color" className="h-10 w-14 rounded-md border border-input cursor-pointer" />
                  <input {...form.register("primaryColor")} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="#6366f1" />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex gap-2">
                <div className="h-8 w-24 rounded-md" style={{ backgroundColor: form.watch("primaryColor") }} />
                <button type="button" className="h-8 rounded-md px-4 text-sm text-white" style={{ backgroundColor: form.watch("primaryColor") }}>
                  Book Now
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold">Public Booking Page</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your Booking URL</label>
              <div className="flex items-center gap-2">
                <input
                  value={`${process.env["NEXT_PUBLIC_APP_URL"] ?? "https://bookflow.app"}/book/${tenant.slug}`}
                  readOnly
                  className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/book/${tenant.slug}`);
                    toast.success("Copied!");
                  }}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}
