import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Calendar,
  Users,
  BarChart3,
  Bell,
  CreditCard,
  Globe,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BookFlow — The modern booking platform for service businesses",
};

const FEATURES = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Real-time availability engine with timezone support, staff calendars, and conflict prevention.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    description: "Track customer history, spending, preferences, and notes — all in one place.",
  },
  {
    icon: BarChart3,
    title: "Business Analytics",
    description: "Revenue tracking, popular services, peak hours, staff performance, and more.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    description: "Automated email, SMS, and WhatsApp reminders to reduce no-shows.",
  },
  {
    icon: CreditCard,
    title: "Online Payments",
    description: "Accept deposits or full payments via Stripe. Secure checkout built in.",
  },
  {
    icon: Globe,
    title: "Public Booking Page",
    description: "Branded booking page your customers can use 24/7 from any device.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for solo practitioners",
    features: [
      "1 staff member",
      "50 bookings/month",
      "Email reminders",
      "Public booking page",
      "Basic analytics",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For growing service businesses",
    features: [
      "Unlimited staff",
      "Unlimited bookings",
      "SMS + WhatsApp reminders",
      "Advanced analytics",
      "Custom branding",
      "Google Calendar sync",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$149",
    period: "/month",
    description: "For agencies and enterprises",
    features: [
      "Everything in Pro",
      "Public API access",
      "API key management",
      "White-label features",
      "Priority support",
      "Custom domain",
    ],
    cta: "Contact us",
    highlighted: false,
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="bg-background min-h-screen">
      {/* Nav */}
      <nav className="border-border bg-background/95 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
              BF
            </div>
            <span className="text-lg font-bold">BookFlow</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/auth/login"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Get started free
            </Link>
          </div>

          <Link
            href="/auth/register"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors md:hidden"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="border-primary/20 bg-primary/5 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
            <Zap className="h-3.5 w-3.5" />
            14-day free trial • No credit card required
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            The modern booking platform
            <span className="text-primary"> for service businesses</span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
            BookFlow helps barbers, salons, clinics, consultants, and service professionals manage
            appointments, staff, payments, and customers — all from one dashboard.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/book/demo"
              className="border-border hover:bg-accent flex items-center gap-2 rounded-lg border px-6 py-3 text-base font-semibold transition-colors"
            >
              View demo booking page
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Everything you need to run your business</h2>
            <p className="text-muted-foreground mt-3">
              From booking to billing — BookFlow handles it all.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="border-border bg-card rounded-xl border p-6 shadow-sm"
                >
                  <div className="bg-primary/10 mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
            <p className="text-muted-foreground mt-3">All plans come with a 14-day free trial.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 shadow-sm ${
                  plan.highlighted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-80">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p
                  className={`mt-1 text-sm ${plan.highlighted ? "opacity-80" : "text-muted-foreground"}`}
                >
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span
                    className={`text-sm ${plan.highlighted ? "opacity-70" : "text-muted-foreground"}`}
                  >
                    {plan.period}
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          plan.highlighted ? "opacity-90" : "text-primary"
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/register"
                  className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "text-primary bg-white hover:bg-white/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-center text-sm">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Secure, reliable, and built for scale.</span>
        </div>
        <p>© {new Date().getFullYear()} BookFlow. All rights reserved.</p>
      </footer>
    </div>
  );
}
