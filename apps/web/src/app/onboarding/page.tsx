"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTenantSchema, type CreateTenantInput } from "@/lib/validations/tenant";
import { createServiceSchema, type CreateServiceInput } from "@/lib/validations/service";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validations/staff";
import { toast } from "sonner";
import axios from "axios";
import { Loader2, Building2, Scissors, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { z } from "zod";
import slugify from "slugify";

type OnboardingStep = "business" | "services" | "staff" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("business");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Business form
  const businessForm = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      country: "US",
      currency: "USD",
    },
  });

  // Service form
  const serviceForm = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: { duration: 60, price: 50, bufferTime: 0 },
  });

  // Staff form
  const staffForm = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
  });

  const handleBusinessSubmit = async (data: CreateTenantInput) => {
    setIsLoading(true);
    try {
      const slug = slugify(data.name, { lower: true, strict: true });
      const res = await axios.post<{ data: { id: string; slug: string } }>("/api/tenants", {
        ...data,
        slug,
      });
      setTenantId(res.data.data.id);
      setTenantSlug(res.data.data.slug);
      setStep("services");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Failed to create business"
        : "Something went wrong";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceSubmit = async (data: CreateServiceInput) => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      await axios.post("/api/services", data);
      setStep("staff");
    } catch {
      toast.error("Failed to create service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffSubmit = async (data: CreateStaffInput) => {
    setIsLoading(true);
    try {
      await axios.post("/api/staff", data);
      setStep("done");
    } catch {
      toast.error("Failed to add staff");
    } finally {
      setIsLoading(false);
    }
  };

  const skipStep = () => {
    if (step === "services") setStep("staff");
    else if (step === "staff") setStep("done");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex justify-center gap-2">
          {(["business", "services", "staff", "done"] as OnboardingStep[]).map((s, i) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s === step || (i < ["business", "services", "staff", "done"].indexOf(step))
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          {/* Business setup */}
          {step === "business" && (
            <div className="p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Set up your business</h2>
                  <p className="text-sm text-muted-foreground">Tell us about your business</p>
                </div>
              </div>

              <form onSubmit={businessForm.handleSubmit(handleBusinessSubmit)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Business Name *</label>
                  <input
                    {...businessForm.register("name")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Jane's Hair Salon"
                  />
                  {businessForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">{businessForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Description</label>
                  <textarea
                    {...businessForm.register("description")}
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Brief description of your business..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Phone</label>
                    <input
                      {...businessForm.register("phone")}
                      type="tel"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">City</label>
                    <input
                      {...businessForm.register("city")}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="New York"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Continue
                </button>
              </form>
            </div>
          )}

          {/* Service setup */}
          {step === "services" && (
            <div className="p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Scissors className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Add your first service</h2>
                  <p className="text-sm text-muted-foreground">What services do you offer?</p>
                </div>
              </div>

              <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Service Name *</label>
                  <input
                    {...serviceForm.register("name")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Haircut & Style"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Duration (minutes) *</label>
                    <input
                      {...serviceForm.register("duration", { valueAsNumber: true })}
                      type="number"
                      min="5"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Price ($) *</label>
                    <input
                      {...serviceForm.register("price", { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Service
                  </button>
                  <button
                    type="button"
                    onClick={skipStep}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Staff setup */}
          {step === "staff" && (
            <div className="p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Add your first team member</h2>
                  <p className="text-sm text-muted-foreground">Who will be taking appointments?</p>
                </div>
              </div>

              <form onSubmit={staffForm.handleSubmit(handleStaffSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Name *</label>
                    <input
                      {...staffForm.register("name")}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Email *</label>
                    <input
                      {...staffForm.register("email")}
                      type="email"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Staff
                  </button>
                  <button
                    type="button"
                    onClick={skipStep}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="px-8 py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">You&apos;re all set!</h2>
              <p className="mt-2 text-muted-foreground">
                Your business is ready. Let&apos;s go to your dashboard.
              </p>
              {tenantSlug && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Your public booking page:{" "}
                  <a
                    href={`/book/${tenantSlug}`}
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    bookflow.app/book/{tenantSlug}
                  </a>
                </p>
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Step {["business", "services", "staff", "done"].indexOf(step) + 1} of 4
        </p>
      </div>
    </div>
  );
}
