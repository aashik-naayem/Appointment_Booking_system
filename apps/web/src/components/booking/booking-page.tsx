"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { format } from "date-fns";
import axios from "axios";
import { cn } from "@/lib/utils/cn";
import type { Service } from "@bookflow/database";
import type { Serialized } from "@/lib/utils/serialize";
import { Clock, DollarSign, User, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { TimeSlot } from "@/lib/services/availability";

type BookingTenant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
  timezone: string;
  currency: string;
  requireDeposit: boolean;
  services: (Serialized<Service> & {
    category: { id: string; name: string; color: string | null } | null;
    staff: {
      staff: {
        id: string;
        name: string;
        avatarUrl: string | null;
        title: string | null;
        bio: string | null;
      };
    }[];
  })[];
  staff: {
    id: string;
    name: string;
    avatarUrl: string | null;
    title: string | null;
    bio: string | null;
  }[];
};

type BookingStep = "service" | "staff" | "datetime" | "details" | "confirm" | "success";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
type CustomerForm = z.infer<typeof customerFormSchema>;

export function BookingPage({ tenant }: { tenant: BookingTenant }) {
  const [step, setStep] = useState<BookingStep>("service");
  const [selectedService, setSelectedService] = useState<BookingTenant["services"][0] | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<BookingTenant["staff"][0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerFormSchema),
  });

  // Generate date options (next 60 days)
  const dateOptions = Array.from({ length: 60 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return format(d, "yyyy-MM-dd");
  });

  // Fetch available slots
  const { data: slots, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["slots", tenant.id, selectedService?.id, selectedDate, selectedStaff?.id],
    queryFn: async () => {
      if (!selectedDate || !selectedService) return [];
      const params = new URLSearchParams({
        tenantId: tenant.id,
        serviceId: selectedService.id,
        date: selectedDate,
        timezone: tenant.timezone,
        ...(selectedStaff && { staffId: selectedStaff.id }),
      });
      const res = await axios.get<{ data: TimeSlot[] }>(`/api/availability?${params.toString()}`);
      return res.data.data ?? [];
    },
    enabled: !!selectedDate && !!selectedService,
  });

  const handleBookingSubmit = async (data: CustomerForm) => {
    if (!selectedService || !selectedSlot) return;
    setIsSubmitting(true);

    try {
      const res = await axios.post<{ data: { bookingReference: string } }>("/api/appointments", {
        tenantId: tenant.id,
        serviceId: selectedService.id,
        staffId: selectedStaff?.id,
        startTime: selectedSlot.startTime,
        customerName: data.name,
        customerEmail: data.email,
        customerPhone: data.phone,
        customerNotes: data.notes,
        timezone: tenant.timezone,
      });

      setBookingRef(res.data.data.bookingReference);
      setStep("success");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { error?: string })?.error ?? "Booking failed")
        : "Something went wrong";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    const stepOrder: BookingStep[] = ["service", "staff", "datetime", "details", "confirm"];
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]!);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Business header */}
      <header
        className="py-10 text-center text-white"
        style={{ backgroundColor: tenant.primaryColor }}
      >
        {tenant.logoUrl && (
          <Image
            src={tenant.logoUrl}
            alt={tenant.name}
            width={64}
            height={64}
            className="mx-auto mb-3 rounded-xl object-cover"
          />
        )}
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        {tenant.description && (
          <p className="mx-auto mt-1 max-w-sm px-4 text-sm opacity-90">{tenant.description}</p>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Progress indicator */}
        {step !== "success" && (
          <div className="mb-6 flex items-center justify-between">
            {["service", "datetime", "details", "confirm"].map((s, i) => {
              const steps: BookingStep[] = ["service", "datetime", "details", "confirm"];
              const currentIdx = steps.indexOf(step as BookingStep);
              const isDone = i < currentIdx;
              const isCurrent = i === currentIdx;

              return (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      isDone
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                    style={isCurrent ? { backgroundColor: tenant.primaryColor } : undefined}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  {i < 3 && (
                    <div
                      className={cn(
                        "mx-1 h-0.5 w-12 sm:w-20",
                        isDone ? "bg-green-500" : "bg-muted",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Steps */}
        <div className="border-border bg-card rounded-xl border shadow-sm">
          {/* Service selection */}
          {step === "service" && (
            <div className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Select a Service</h2>
              <div className="space-y-3">
                {tenant.services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setSelectedService(service);
                      setStep(
                        service.requiresStaff && service.staff.length > 0 ? "staff" : "datetime",
                      );
                    }}
                    className="border-border hover:border-primary hover:bg-accent/50 flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors"
                  >
                    <div className="flex-1">
                      {service.category && (
                        <span
                          className="mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: service.category.color ?? "#6366f1" }}
                        >
                          {service.category.name}
                        </span>
                      )}
                      <p className="font-medium">{service.name}</p>
                      {service.description && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                          {service.description}
                        </p>
                      )}
                      <div className="text-muted-foreground mt-2 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duration} min
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {Number(service.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-1 h-5 w-5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Staff selection */}
          {step === "staff" && selectedService && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Select Staff</h2>
                <button
                  onClick={goBack}
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSelectedStaff(null);
                    setStep("datetime");
                  }}
                  className="border-border hover:border-primary hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
                >
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                    <User className="text-muted-foreground h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Any available staff</p>
                    <p className="text-muted-foreground text-sm">First available</p>
                  </div>
                </button>

                {selectedService.staff.map(({ staff }) => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelectedStaff(staff);
                      setStep("datetime");
                    }}
                    className="border-border hover:border-primary hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
                  >
                    <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                      {staff.avatarUrl ? (
                        <Image
                          src={staff.avatarUrl}
                          alt={staff.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-medium">
                          {staff.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{staff.name}</p>
                      {staff.title && (
                        <p className="text-muted-foreground text-sm">{staff.title}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time selection */}
          {step === "datetime" && selectedService && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Choose Date & Time</h2>
                <button
                  onClick={goBack}
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              </div>

              {/* Date picker */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Select Date</label>
                <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-7">
                  {dateOptions.slice(0, 28).map((d) => {
                    const dateObj = new Date(d + "T00:00:00");
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className={cn(
                          "flex flex-col items-center rounded-lg border p-2 text-xs transition-colors",
                          selectedDate === d
                            ? "border-primary text-white"
                            : "border-border hover:border-primary hover:bg-accent/50",
                        )}
                        style={
                          selectedDate === d
                            ? {
                                backgroundColor: tenant.primaryColor,
                                borderColor: tenant.primaryColor,
                              }
                            : undefined
                        }
                      >
                        <span className="font-medium">{format(dateObj, "EEE")}</span>
                        <span className="text-base font-bold leading-tight">
                          {format(dateObj, "d")}
                        </span>
                        <span>{format(dateObj, "MMM")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Available Times</label>
                  {slotsLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : !slots || slots.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No available times on this date. Please select another date.
                    </p>
                  ) : (
                    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                      {slots.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep("details");
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                            selectedSlot?.startTime === slot.startTime
                              ? "text-white"
                              : "border-border hover:border-primary hover:bg-accent/50",
                          )}
                          style={
                            selectedSlot?.startTime === slot.startTime
                              ? {
                                  backgroundColor: tenant.primaryColor,
                                  borderColor: tenant.primaryColor,
                                }
                              : undefined
                          }
                        >
                          {format(new Date(slot.startTime), "HH:mm")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customer details */}
          {step === "details" && (
            <form onSubmit={form.handleSubmit(() => setStep("confirm"))} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your Details</h2>
                <button
                  type="button"
                  onClick={goBack}
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register("name")}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    placeholder="Your full name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-destructive mt-1 text-xs">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register("email")}
                    type="email"
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    placeholder="your@email.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-destructive mt-1 text-xs">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone</label>
                  <input
                    {...form.register("phone")}
                    type="tel"
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Notes for the business</label>
                  <textarea
                    {...form.register("notes")}
                    rows={3}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    placeholder="Any special requests or information..."
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                Continue to Review
              </button>
            </form>
          )}

          {/* Confirm */}
          {step === "confirm" && selectedService && selectedSlot && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Review & Confirm</h2>
                <button
                  onClick={goBack}
                  className="text-primary flex items-center gap-1 text-sm hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              </div>

              <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
                <Row label="Service" value={selectedService.name} />
                {selectedStaff && <Row label="Staff" value={selectedStaff.name} />}
                <Row
                  label="Date"
                  value={format(new Date(selectedSlot.startTime), "EEEE, MMMM d, yyyy")}
                />
                <Row label="Time" value={format(new Date(selectedSlot.startTime), "HH:mm")} />
                <Row label="Duration" value={`${selectedService.duration} min`} />
                <Row label="Price" value={`$${Number(selectedService.price).toFixed(2)}`} />
                <Row label="Name" value={form.getValues("name")} />
                <Row label="Email" value={form.getValues("email")} />
              </div>

              <button
                onClick={form.handleSubmit(handleBookingSubmit)}
                disabled={isSubmitting}
                className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {isSubmitting ? "Confirming..." : "Confirm Booking"}
              </button>

              <p className="text-muted-foreground mt-3 text-center text-xs">
                You&apos;ll receive a confirmation email shortly after booking.
              </p>
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div className="px-6 py-12 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold">Booking Confirmed!</h2>
              <p className="text-muted-foreground mt-2">
                Your appointment has been successfully booked. A confirmation email is on its way.
              </p>
              {bookingRef && (
                <div className="border-border bg-muted/30 mt-4 rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">Booking Reference</p>
                  <p className="font-mono text-lg font-bold tracking-widest">
                    #{bookingRef.slice(-8).toUpperCase()}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setStep("service");
                  setSelectedService(null);
                  setSelectedStaff(null);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                  form.reset();
                }}
                className="border-border hover:bg-accent mt-6 rounded-lg border px-6 py-2 text-sm font-medium transition-colors"
              >
                Book Another Appointment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
