"use client";

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, CreditCard, Zap, ArrowUpRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import type { Subscription, SubscriptionPlan, Tenant } from "@bookflow/database";

const PLANS = [
  {
    plan: "STARTER" as SubscriptionPlan,
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: ["1 staff member", "50 bookings/month", "Email reminders", "Basic analytics"],
  },
  {
    plan: "PRO" as SubscriptionPlan,
    name: "Pro",
    monthlyPrice: 79,
    yearlyPrice: 790,
    features: ["Unlimited staff", "Unlimited bookings", "SMS + WhatsApp", "Advanced analytics", "Custom branding"],
    popular: true,
  },
  {
    plan: "BUSINESS" as SubscriptionPlan,
    name: "Business",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    features: ["Everything in Pro", "Public API", "API keys", "White-label", "Priority support"],
  },
];

const STATUS_DISPLAY: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  ACTIVE: { label: "Active", className: "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300", icon: <CheckCircle2 className="h-4 w-4" /> },
  TRIALING: { label: "Free Trial", className: "text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300", icon: <Zap className="h-4 w-4" /> },
  PAST_DUE: { label: "Past Due", className: "text-amber-600 bg-amber-100 dark:bg-amber-900 dark:text-amber-300", icon: <AlertTriangle className="h-4 w-4" /> },
  CANCELED: { label: "Cancelled", className: "text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300", icon: <AlertTriangle className="h-4 w-4" /> },
  PAUSED: { label: "Paused", className: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300", icon: null },
};

type Props = {
  subscription: Subscription | null;
  tenant: Tenant;
  hasStripeCustomer: boolean;
};

export function BillingClient({ subscription, tenant, hasStripeCustomer }: Props) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  const checkoutMutation = useMutation({
    mutationFn: ({ plan, interval }: { plan: SubscriptionPlan; interval: "monthly" | "yearly" }) =>
      axios.post<{ data: { url: string } }>("/api/billing/checkout", { plan, interval }),
    onSuccess: (res) => {
      if (res.data.data.url) {
        window.location.href = res.data.data.url;
      }
    },
    onError: () => toast.error("Failed to start checkout"),
  });

  const portalMutation = useMutation({
    mutationFn: () => axios.post<{ data: { url: string } }>("/api/billing/portal"),
    onSuccess: (res) => {
      if (res.data.data.url) window.location.href = res.data.data.url;
    },
    onError: () => toast.error("Failed to open billing portal"),
  });

  const statusConfig = subscription ? STATUS_DISPLAY[subscription.status] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing.</p>
      </div>

      {/* Current plan */}
      {subscription && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-xl font-bold">{subscription.plan}</h2>
                {statusConfig && (
                  <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", statusConfig.className)}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                )}
              </div>
              {subscription.status === "TRIALING" && subscription.trialEnd && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Trial ends {format(new Date(subscription.trialEnd), "MMM d, yyyy")}
                </p>
              )}
              {["ACTIVE", "TRIALING"].includes(subscription.status) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Renews {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                </p>
              )}
              {subscription.status === "PAST_DUE" && subscription.gracePeriodEnd && (
                <p className="mt-1 text-sm text-amber-600 font-medium">
                  ⚠ Payment failed. Grace period until {format(new Date(subscription.gracePeriodEnd), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {hasStripeCustomer && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Manage Billing
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {subscription.maxBookings && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Monthly Bookings</span>
                <span className="font-medium">{subscription.bookingsThisMonth} / {subscription.maxBookings}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", subscription.bookingsThisMonth / subscription.maxBookings > 0.9 ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${Math.min(100, (subscription.bookingsThisMonth / subscription.maxBookings) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* No subscription */}
      {!subscription && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              No active subscription. Start a free 14-day trial to unlock all features.
            </p>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Available Plans</h2>
          <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
            {(["monthly", "yearly"] as const).map((i) => (
              <button
                key={i}
                onClick={() => setBillingInterval(i)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors capitalize",
                  billingInterval === i ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {i}
                {i === "yearly" && <span className="ml-1 text-xs text-green-600">-20%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.plan === plan.plan;
            const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

            return (
              <div
                key={plan.plan}
                className={cn(
                  "rounded-lg border p-5 shadow-sm",
                  plan.popular ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  isCurrent && !plan.popular && "border-primary",
                )}
              >
                {plan.popular && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-75">Most Popular</p>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className={cn("text-sm", plan.popular ? "opacity-70" : "text-muted-foreground")}>
                    /{billingInterval === "monthly" ? "mo" : "yr"}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", plan.popular ? "opacity-80" : "text-primary")} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => checkoutMutation.mutate({ plan: plan.plan, interval: billingInterval })}
                  disabled={isCurrent || checkoutMutation.isPending}
                  className={cn(
                    "mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                    plan.popular
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                    isCurrent && "cursor-not-allowed",
                  )}
                >
                  {checkoutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// React useState was imported inline for brevity
import { useState } from "react";
