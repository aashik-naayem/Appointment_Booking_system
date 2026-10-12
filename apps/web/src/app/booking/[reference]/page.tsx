import { prisma } from "@bookflow/database";
import { notFound } from "next/navigation";
import { format } from "date-fns";

export const metadata = { title: "Your booking" };

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { bookingReference: reference, deletedAt: null },
    include: {
      service: { select: { name: true } },
      staff: { select: { name: true } },
      tenant: { select: { name: true } },
    },
  });

  if (!appointment) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-md space-y-3 rounded-xl border p-8 shadow-lg">
        <h1 className="text-xl font-semibold">{appointment.tenant.name}</h1>
        <p className="text-muted-foreground text-sm">Booking reference: {reference}</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Service</dt>
            <dd>{appointment.service.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">With</dt>
            <dd>{appointment.staff?.name ?? "Any available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">When</dt>
            <dd>{format(appointment.startTime, "PPP p")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{appointment.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
