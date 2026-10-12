import { requireTenant } from "@/lib/permissions";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenant();

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DashboardSidebar tenant={ctx.tenant} user={ctx.user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader user={ctx.user} tenant={ctx.tenant} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
