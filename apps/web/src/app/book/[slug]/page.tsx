import { prisma } from "@bookflow/database";
import { notFound } from "next/navigation";
import { BookingPage } from "@/components/booking/booking-page";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant(slug);

  if (!tenant) return { title: "Business Not Found" };

  return {
    title: `Book at ${tenant.name}`,
    description: tenant.description ?? `Book an appointment at ${tenant.name}`,
    openGraph: {
      images: tenant.logoUrl ? [{ url: tenant.logoUrl }] : [],
    },
  };
}

async function getTenant(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug, isActive: true, isPublic: true, deletedAt: null },
    include: {
      services: {
        where: { isActive: true, deletedAt: null },
        include: {
          category: { select: { id: true, name: true, color: true } },
          staff: {
            include: {
              staff: {
                where: { status: "ACTIVE", deletedAt: null },
                select: { id: true, name: true, avatarUrl: true, title: true },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      businessHours: {
        orderBy: { dayOfWeek: "asc" },
      },
      staff: {
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, avatarUrl: true, title: true, bio: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenant(slug);

  if (!tenant) notFound();

  return <BookingPage tenant={tenant} />;
}
