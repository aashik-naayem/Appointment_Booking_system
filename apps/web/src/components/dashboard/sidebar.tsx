"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import type { Tenant } from "@bookflow/database";
import type { UserRole } from "@bookflow/database";
import {
  LayoutDashboard,
  Calendar,
  CalendarCheck2,
  Users,
  UserCog,
  Scissors,
  BarChart3,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Globe,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: CalendarCheck2 },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/services", label: "Services", icon: Scissors },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Props = {
  tenant: Tenant;
  user: { id: string; name: string | null; role: UserRole };
};

export function DashboardSidebar({ tenant, user }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            {tenant.logoUrl ? (
              <Image
                src={tenant.logoUrl}
                alt={tenant.name}
                width={28}
                height={28}
                className="rounded-md object-cover"
              />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {tenant.name[0]?.toUpperCase()}
              </div>
            )}
            <span className="truncate font-semibold text-sidebar-foreground text-sm">
              {tenant.name}
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              {tenant.name[0]?.toUpperCase()}
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground",
                    collapsed && "justify-center px-2",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Public booking link */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <Link
            href={`/book/${tenant.slug}`}
            target="_blank"
            className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Public booking page</span>
          </Link>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
