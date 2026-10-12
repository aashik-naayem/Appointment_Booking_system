"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import type { Tenant } from "@bookflow/database";
import type { UserRole } from "@bookflow/database";
import { Moon, Sun, Bell, LogOut, User, Settings, ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import Image from "next/image";

type Props = {
  user: { id: string; name: string | null; email: string; image?: string | null; role: UserRole };
  tenant: Tenant;
};

export function DashboardHeader({ user, tenant }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-border bg-background flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">{/* Breadcrumbs would go here */}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>

        {/* Notifications */}
        <button
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="border-border hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "User"}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
                  {user.name?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <span className="hidden max-w-32 truncate font-medium sm:block">
                {user.name ?? user.email}
              </span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="border-border bg-popover animate-in fade-in-0 zoom-in-95 z-50 min-w-48 rounded-md border p-1 shadow-lg"
              align="end"
              sideOffset={4}
            >
              <div className="text-muted-foreground border-border mb-1 border-b px-2 py-1.5 text-xs font-medium">
                {user.email}
              </div>

              <DropdownMenu.Item asChild>
                <Link
                  href="/settings/profile"
                  className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="bg-border my-1 h-px" />

              <DropdownMenu.Item asChild>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
