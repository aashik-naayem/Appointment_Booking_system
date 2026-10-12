"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { updateTenantSchema, type UpdateTenantInput } from "@/lib/validations/tenant";
import type { Tenant, BusinessHours, Holiday } from "@bookflow/database";
import type { Serialized } from "@/lib/utils/serialize";
import { Save, Trash2, Plus, Globe, Clock, Palette } from "lucide-react";
import { format } from "date-fns";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const TIMEZONES = Intl.supportedValuesOf("timeZone");

type Props = {
  tenant: Serialized<Tenant>;
  businessHours: Serialized<BusinessHours>[];
  holidays: Serialized<Holiday>[];
};

export function SettingsClient({
  tenant,
  businessHours: initialHours,
  holidays: initialHolidays,
}: Props) {
  const [activeTab, setActiveTab] = useState<"general" | "hours" | "branding" | "notifications">(
    "general",
  );
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
      <div className="border-border flex gap-1 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent"
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
        <form
          onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
          className="max-w-2xl space-y-6"
        >
          <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-sm">
            <h2 className="font-semibold">Business Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Business Name</label>
                <input
                  {...form.register("name")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  {...form.register("description")}
                  rows={2}
                  className="border-input bg-background focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <input
                  {...form.register("email")}
                  type="email"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone</label>
                <input
                  {...form.register("phone")}
                  type="tel"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input
                  {...form.register("address")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">City</label>
                <input
                  {...form.register("city")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">State</label>
                <input
                  {...form.register("state")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
            </div>
          </div>

          <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-sm">
            <h2 className="font-semibold">Booking Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Timezone</label>
                <select
                  {...form.register("timezone")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Currency</label>
                <select
                  {...form.register("currency")}
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Booking Lead Time (min)</label>
                <input
                  {...form.register("bookingLeadTime", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Min time before booking can be made
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Booking Window (days)</label>
                <input
                  {...form.register("bookingWindowDays", { valueAsNumber: true })}
                  type="number"
                  min="1"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Cancellation Notice (hours)
                </label>
                <input
                  {...form.register("cancellationHours", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("autoConfirm")} className="rounded" />
                <span className="font-medium">Auto-confirm bookings</span>
                <span className="text-muted-foreground">(skip manual confirmation)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register("allowGuestBooking")}
                  className="rounded"
                />
                <span className="font-medium">Allow guest bookings</span>
                <span className="text-muted-foreground">(no account required)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("requireDeposit")} className="rounded" />
                <span className="font-medium">Require deposit</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}

      {/* Business Hours */}
      {activeTab === "hours" && (
        <div className="max-w-2xl space-y-6">
          <div className="border-border bg-card rounded-lg border p-6 shadow-sm">
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
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, isOpen: e.target.checked } : p)),
                        )
                      }
                      className="rounded"
                    />
                    Open
                  </label>
                  {h.isOpen && (
                    <>
                      <input
                        type="time"
                        value={h.startTime}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, startTime: e.target.value } : p,
                            ),
                          )
                        }
                        className="border-input bg-background focus-visible:ring-ring rounded-md border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <input
                        type="time"
                        value={h.endTime}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, endTime: e.target.value } : p)),
                          )
                        }
                        className="border-input bg-background focus-visible:ring-ring rounded-md border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2"
                      />
                    </>
                  )}
                  {!h.isOpen && <span className="text-muted-foreground text-sm">Closed</span>}
                </div>
              ))}
            </div>
            <button
              onClick={() => hoursMutation.mutate(hours)}
              disabled={hoursMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {hoursMutation.isPending ? "Saving..." : "Save Hours"}
            </button>
          </div>

          {/* Holidays */}
          <div className="border-border bg-card rounded-lg border p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Holidays & Closures</h2>
            <div className="mb-4 space-y-2">
              {holidays.length === 0 ? (
                <p className="text-muted-foreground text-sm">No holidays configured.</p>
              ) : (
                holidays.map((h) => (
                  <div
                    key={h.id}
                    className="border-border flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(h.date), "MMMM d, yyyy")}
                        {h.recurring && " · Annual"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteHolidayMutation.mutate(h.id)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1"
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
                className="border-input bg-background focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
              />
              <input
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                type="date"
                className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
              />
              <button
                onClick={() => {
                  if (newHolidayName && newHolidayDate) {
                    addHolidayMutation.mutate({ name: newHolidayName, date: newHolidayDate });
                  }
                }}
                disabled={!newHolidayName || !newHolidayDate || addHolidayMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branding */}
      {activeTab === "branding" && (
        <form
          onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
          className="max-w-2xl space-y-6"
        >
          <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-sm">
            <h2 className="font-semibold">Brand Colors</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    {...form.register("primaryColor")}
                    type="color"
                    className="border-input h-10 w-14 cursor-pointer rounded-md border"
                  />
                  <input
                    {...form.register("primaryColor")}
                    className="border-input bg-background focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            <div className="border-border rounded-md border p-4">
              <p className="text-muted-foreground mb-2 text-xs">Preview</p>
              <div className="flex gap-2">
                <div
                  className="h-8 w-24 rounded-md"
                  style={{ backgroundColor: form.watch("primaryColor") }}
                />
                <button
                  type="button"
                  className="h-8 rounded-md px-4 text-sm text-white"
                  style={{ backgroundColor: form.watch("primaryColor") }}
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>

          <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-sm">
            <h2 className="font-semibold">Public Booking Page</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your Booking URL</label>
              <div className="flex items-center gap-2">
                <input
                  value={`${process.env["NEXT_PUBLIC_APP_URL"] ?? "https://bookflow.app"}/book/${tenant.slug}`}
                  readOnly
                  className="border-input bg-muted flex-1 rounded-md border px-3 py-2 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/book/${tenant.slug}`);
                    toast.success("Copied!");
                  }}
                  className="border-border hover:bg-accent rounded-md border px-3 py-2 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}
