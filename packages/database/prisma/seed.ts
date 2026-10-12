/**
 * BookFlow Database Seed
 *
 * Creates realistic demo data so the application looks professional.
 * Run: npm run db:seed  (from packages/database)
 *
 * Demo credentials:
 *   Owner:  demo@bookflow.app / Demo1234
 *   Admin:  admin@helixsalon.com / Demo1234
 *   Staff:  staff@helixsalon.com / Demo1234
 */

import {
  PrismaClient,
  UserRole,
  AppointmentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  DayOfWeek,
  NotificationType,
  NotificationChannel,
} from "../src/generated/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, startOfDay, setHours, setMinutes, subDays } from "date-fns";

const prisma = new PrismaClient();

let DEMO_PASSWORD_HASH = "";

async function main() {
  DEMO_PASSWORD_HASH = await bcrypt.hash("Demo1234", 12);
  console.log("🌱 Seeding BookFlow demo data...\n");

  // ============================================================
  // TENANT 1: Helix Hair Studio (full-featured demo)
  // ============================================================
  console.log("Creating Helix Hair Studio...");

  const helixTenant = await prisma.tenant.upsert({
    where: { slug: "helix-hair-studio" },
    create: {
      name: "Helix Hair Studio",
      slug: "helix-hair-studio",
      description: "Premium hair salon offering cuts, color, and styling.",
      email: "hello@helixsalon.com",
      phone: "+1 (555) 234-5678",
      address: "150 5th Avenue",
      city: "New York",
      state: "NY",
      country: "US",
      postalCode: "10010",
      timezone: "America/New_York",
      currency: "USD",
      primaryColor: "#7c3aed",
      isPublic: true,
      isActive: true,
      autoConfirm: true,
      bookingLeadTime: 60,
      bookingWindowDays: 60,
      cancellationHours: 24,
    },
    update: {},
  });

  // Owner user
  const helixOwner = await prisma.user.upsert({
    where: { email: "demo@bookflow.app" },
    create: {
      email: "demo@bookflow.app",
      name: "Alex Rivera",
      password: DEMO_PASSWORD_HASH,
      role: UserRole.OWNER,
      tenantId: helixTenant.id,
      emailVerified: new Date(),
    },
    update: { tenantId: helixTenant.id, role: UserRole.OWNER },
  });

  // Admin user
  const helixAdmin = await prisma.user.upsert({
    where: { email: "admin@helixsalon.com" },
    create: {
      email: "admin@helixsalon.com",
      name: "Jordan Kim",
      password: DEMO_PASSWORD_HASH,
      role: UserRole.ADMIN,
      tenantId: helixTenant.id,
      emailVerified: new Date(),
    },
    update: {},
  });

  // Business hours: Mon-Sat 9am-7pm, Sunday closed
  const daysConfig = [
    { day: DayOfWeek.MONDAY, open: true, start: "09:00", end: "19:00" },
    { day: DayOfWeek.TUESDAY, open: true, start: "09:00", end: "19:00" },
    { day: DayOfWeek.WEDNESDAY, open: true, start: "09:00", end: "19:00" },
    { day: DayOfWeek.THURSDAY, open: true, start: "09:00", end: "20:00" },
    { day: DayOfWeek.FRIDAY, open: true, start: "09:00", end: "20:00" },
    { day: DayOfWeek.SATURDAY, open: true, start: "10:00", end: "18:00" },
    { day: DayOfWeek.SUNDAY, open: false, start: "10:00", end: "16:00" },
  ];

  for (const cfg of daysConfig) {
    await prisma.businessHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: helixTenant.id, dayOfWeek: cfg.day } },
      create: {
        tenantId: helixTenant.id,
        dayOfWeek: cfg.day,
        startTime: cfg.start,
        endTime: cfg.end,
        isOpen: cfg.open,
      },
      update: { startTime: cfg.start, endTime: cfg.end, isOpen: cfg.open },
    });
  }

  // Service categories
  const catHair = await prisma.serviceCategory.upsert({
    where: { tenantId_name: { tenantId: helixTenant.id, name: "Hair" } },
    create: { tenantId: helixTenant.id, name: "Hair", color: "#7c3aed", sortOrder: 1 },
    update: {},
  });

  const catColor = await prisma.serviceCategory.upsert({
    where: { tenantId_name: { tenantId: helixTenant.id, name: "Color" } },
    create: { tenantId: helixTenant.id, name: "Color", color: "#db2777", sortOrder: 2 },
    update: {},
  });

  const catTreatment = await prisma.serviceCategory.upsert({
    where: { tenantId_name: { tenantId: helixTenant.id, name: "Treatment" } },
    create: { tenantId: helixTenant.id, name: "Treatment", color: "#0891b2", sortOrder: 3 },
    update: {},
  });

  // Services
  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "service-helix-cut-001" },
      create: {
        id: "service-helix-cut-001",
        tenantId: helixTenant.id,
        categoryId: catHair.id,
        name: "Women's Haircut & Style",
        description: "Precision cut tailored to your face shape, blow-dry and style included.",
        duration: 60,
        bufferTime: 10,
        price: 85,
        isActive: true,
        sortOrder: 1,
      },
      update: {},
    }),
    prisma.service.upsert({
      where: { id: "service-helix-mcut-001" },
      create: {
        id: "service-helix-mcut-001",
        tenantId: helixTenant.id,
        categoryId: catHair.id,
        name: "Men's Haircut",
        description: "Classic or modern cut with a wash and style.",
        duration: 45,
        bufferTime: 10,
        price: 55,
        isActive: true,
        sortOrder: 2,
      },
      update: {},
    }),
    prisma.service.upsert({
      where: { id: "service-helix-color-001" },
      create: {
        id: "service-helix-color-001",
        tenantId: helixTenant.id,
        categoryId: catColor.id,
        name: "Full Color",
        description: "Single process all-over color. Includes toner and blowout.",
        duration: 120,
        bufferTime: 15,
        price: 145,
        isActive: true,
        sortOrder: 3,
      },
      update: {},
    }),
    prisma.service.upsert({
      where: { id: "service-helix-hi-001" },
      create: {
        id: "service-helix-hi-001",
        tenantId: helixTenant.id,
        categoryId: catColor.id,
        name: "Highlights",
        description: "Partial or full highlights. Foils or balayage technique.",
        duration: 150,
        bufferTime: 15,
        price: 195,
        isActive: true,
        sortOrder: 4,
      },
      update: {},
    }),
    prisma.service.upsert({
      where: { id: "service-helix-deep-001" },
      create: {
        id: "service-helix-deep-001",
        tenantId: helixTenant.id,
        categoryId: catTreatment.id,
        name: "Deep Conditioning Treatment",
        description: "Intensive moisture treatment for damaged or dry hair.",
        duration: 30,
        bufferTime: 5,
        price: 45,
        isActive: true,
        sortOrder: 5,
      },
      update: {},
    }),
  ]);

  // Staff members
  const staffSarah = await prisma.staff.upsert({
    where: { id: "staff-helix-001" },
    create: {
      id: "staff-helix-001",
      tenantId: helixTenant.id,
      name: "Sarah Johnson",
      email: "sarah@helixsalon.com",
      phone: "+15552345678",
      title: "Senior Stylist",
      bio: "10 years of experience. Specializes in color and precision cuts.",
      status: "ACTIVE",
      color: "#7c3aed",
      commission: 40,
    },
    update: {},
  });

  const staffMike = await prisma.staff.upsert({
    where: { id: "staff-helix-002" },
    create: {
      id: "staff-helix-002",
      tenantId: helixTenant.id,
      name: "Mike Chen",
      email: "mike@helixsalon.com",
      phone: "+15553456789",
      title: "Stylist",
      bio: "5 years experience. Expert in men's cuts and fades.",
      status: "ACTIVE",
      color: "#0891b2",
      commission: 35,
    },
    update: {},
  });

  const staffEmma = await prisma.staff.upsert({
    where: { id: "staff-helix-003" },
    create: {
      id: "staff-helix-003",
      tenantId: helixTenant.id,
      name: "Emma Patel",
      email: "emma@helixsalon.com",
      phone: "+15554567890",
      title: "Color Specialist",
      bio: "Certified colorist with expertise in balayage and creative color.",
      status: "ACTIVE",
      color: "#db2777",
      commission: 45,
    },
    update: {},
  });

  // Staff service assignments
  const staffServiceMap = [
    {
      staffId: staffSarah.id,
      serviceIds: [services[0]!.id, services[2]!.id, services[3]!.id, services[4]!.id],
    },
    { staffId: staffMike.id, serviceIds: [services[0]!.id, services[1]!.id] },
    { staffId: staffEmma.id, serviceIds: [services[2]!.id, services[3]!.id, services[4]!.id] },
  ];

  for (const { staffId, serviceIds } of staffServiceMap) {
    for (const serviceId of serviceIds) {
      await prisma.staffService.upsert({
        where: { staffId_serviceId: { staffId, serviceId } },
        create: { staffId, serviceId },
        update: {},
      });
    }
  }

  // Staff working hours (Mon-Sat)
  const workingDays = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  for (const staff of [staffSarah, staffMike, staffEmma]) {
    for (const day of workingDays) {
      const isWeekend = day === DayOfWeek.SATURDAY;
      await prisma.staffWorkingHours.upsert({
        where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: day } },
        create: {
          staffId: staff.id,
          dayOfWeek: day,
          startTime: isWeekend ? "10:00" : "09:00",
          endTime: isWeekend ? "17:00" : "19:00",
          isWorking: true,
        },
        update: {},
      });
    }
    // Sunday off
    await prisma.staffWorkingHours.upsert({
      where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: DayOfWeek.SUNDAY } },
      create: {
        staffId: staff.id,
        dayOfWeek: DayOfWeek.SUNDAY,
        startTime: "10:00",
        endTime: "16:00",
        isWorking: false,
      },
      update: { isWorking: false },
    });
  }

  // Subscription
  await prisma.subscription.upsert({
    where: { tenantId: helixTenant.id },
    create: {
      tenantId: helixTenant.id,
      stripeSubscriptionId: "sub_demo_helix_pro",
      stripeCustomerId: "cus_demo_helix",
      stripePriceId: "price_demo_pro_monthly",
      stripeProductId: "prod_demo_pro",
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      interval: "month",
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
      maxStaff: null,
      maxBookings: null,
      bookingsThisMonth: 47,
    },
    update: {},
  });

  // Notification preferences
  const notifPrefs = [
    {
      type: NotificationType.BOOKING_CONFIRMATION,
      channel: NotificationChannel.EMAIL,
      enabled: true,
    },
    {
      type: NotificationType.BOOKING_REMINDER,
      channel: NotificationChannel.EMAIL,
      enabled: true,
      hoursBeforeReminder: 24,
    },
    {
      type: NotificationType.BOOKING_REMINDER,
      channel: NotificationChannel.EMAIL,
      enabled: true,
      hoursBeforeReminder: 2,
    },
    {
      type: NotificationType.BOOKING_CANCELLATION,
      channel: NotificationChannel.EMAIL,
      enabled: true,
    },
    { type: NotificationType.STAFF_NEW_BOOKING, channel: NotificationChannel.EMAIL, enabled: true },
  ];

  for (const pref of notifPrefs) {
    await prisma.notificationPreference.upsert({
      where: {
        tenantId_type_channel: { tenantId: helixTenant.id, type: pref.type, channel: pref.channel },
      },
      create: { tenantId: helixTenant.id, ...pref },
      update: {},
    });
  }

  // Customers
  const customers = await Promise.all([
    createCustomer(
      helixTenant.id,
      "Isabella Torres",
      "isabella@example.com",
      "+15556789012",
      15,
      12,
      0,
      1240,
    ),
    createCustomer(
      helixTenant.id,
      "James Wilson",
      "james@example.com",
      "+15557890123",
      8,
      7,
      1,
      490,
    ),
    createCustomer(
      helixTenant.id,
      "Sophia Martinez",
      "sophia@example.com",
      "+15558901234",
      22,
      20,
      0,
      2890,
    ),
    createCustomer(
      helixTenant.id,
      "Daniel Lee",
      "daniel@example.com",
      "+15559012345",
      5,
      4,
      0,
      275,
    ),
    createCustomer(
      helixTenant.id,
      "Olivia Brown",
      "olivia@example.com",
      "+15550123456",
      3,
      2,
      1,
      135,
    ),
    createCustomer(helixTenant.id, "Noah Davis", "noah@example.com", "+15551234560", 1, 0, 0, 0),
  ]);

  // Past appointments (historical data for analytics)
  const now = new Date();
  const apptData = [
    {
      customerId: customers[0]!.id,
      serviceId: services[0]!.id,
      staffId: staffSarah.id,
      daysAgo: 2,
      status: AppointmentStatus.COMPLETED,
      amount: 85,
    },
    {
      customerId: customers[1]!.id,
      serviceId: services[1]!.id,
      staffId: staffMike.id,
      daysAgo: 3,
      status: AppointmentStatus.COMPLETED,
      amount: 55,
    },
    {
      customerId: customers[2]!.id,
      serviceId: services[3]!.id,
      staffId: staffEmma.id,
      daysAgo: 5,
      status: AppointmentStatus.COMPLETED,
      amount: 195,
    },
    {
      customerId: customers[2]!.id,
      serviceId: services[2]!.id,
      staffId: staffEmma.id,
      daysAgo: 7,
      status: AppointmentStatus.COMPLETED,
      amount: 145,
    },
    {
      customerId: customers[3]!.id,
      serviceId: services[1]!.id,
      staffId: staffMike.id,
      daysAgo: 10,
      status: AppointmentStatus.COMPLETED,
      amount: 55,
    },
    {
      customerId: customers[4]!.id,
      serviceId: services[0]!.id,
      staffId: staffSarah.id,
      daysAgo: 14,
      status: AppointmentStatus.CANCELLED,
      amount: 85,
    },
    {
      customerId: customers[0]!.id,
      serviceId: services[4]!.id,
      staffId: staffSarah.id,
      daysAgo: 15,
      status: AppointmentStatus.COMPLETED,
      amount: 45,
    },
    {
      customerId: customers[1]!.id,
      serviceId: services[1]!.id,
      staffId: staffMike.id,
      daysAgo: 20,
      status: AppointmentStatus.NO_SHOW,
      amount: 55,
    },
    {
      customerId: customers[2]!.id,
      serviceId: services[0]!.id,
      staffId: staffSarah.id,
      daysAgo: 28,
      status: AppointmentStatus.COMPLETED,
      amount: 85,
    },
    {
      customerId: customers[3]!.id,
      serviceId: services[4]!.id,
      staffId: staffEmma.id,
      daysAgo: 30,
      status: AppointmentStatus.COMPLETED,
      amount: 45,
    },
  ];

  for (let i = 0; i < apptData.length; i++) {
    const d = apptData[i]!;
    const startTime = setMinutes(setHours(subDays(now, d.daysAgo), 10 + (i % 8)), 0);
    const service = services.find((s) => s.id === d.serviceId)!;
    const endTime = addHours(startTime, service.duration / 60);

    await prisma.appointment.upsert({
      where: { id: `appt-helix-hist-${i}` },
      create: {
        id: `appt-helix-hist-${i}`,
        tenantId: helixTenant.id,
        serviceId: d.serviceId,
        staffId: d.staffId,
        customerId: d.customerId,
        startTime,
        endTime,
        timezone: "America/New_York",
        duration: service.duration,
        status: d.status,
        servicePrice: d.amount,
        totalAmount: d.amount,
        completedAt: d.status === AppointmentStatus.COMPLETED ? endTime : null,
        confirmedAt: startTime,
        bookingReference: `HIST${i.toString().padStart(6, "0")}`,
      },
      update: {},
    });
  }

  // Future appointments (today + upcoming)
  const upcomingAppts = [
    {
      customerId: customers[0]!.id,
      serviceId: services[0]!.id,
      staffId: staffSarah.id,
      daysFromNow: 0,
      hour: 11,
    },
    {
      customerId: customers[1]!.id,
      serviceId: services[1]!.id,
      staffId: staffMike.id,
      daysFromNow: 0,
      hour: 14,
    },
    {
      customerId: customers[2]!.id,
      serviceId: services[3]!.id,
      staffId: staffEmma.id,
      daysFromNow: 1,
      hour: 10,
    },
    {
      customerId: customers[3]!.id,
      serviceId: services[1]!.id,
      staffId: staffMike.id,
      daysFromNow: 2,
      hour: 15,
    },
    {
      customerId: customers[4]!.id,
      serviceId: services[2]!.id,
      staffId: staffEmma.id,
      daysFromNow: 3,
      hour: 13,
    },
    {
      customerId: customers[5]!.id,
      serviceId: services[0]!.id,
      staffId: staffSarah.id,
      daysFromNow: 5,
      hour: 16,
    },
  ];

  for (let i = 0; i < upcomingAppts.length; i++) {
    const d = upcomingAppts[i]!;
    const startTime = setMinutes(setHours(addDays(startOfDay(now), d.daysFromNow), d.hour), 0);
    const service = services.find((s) => s.id === d.serviceId)!;
    const endTime = addMinutes(startTime, service.duration);

    await prisma.appointment.upsert({
      where: { id: `appt-helix-upcoming-${i}` },
      create: {
        id: `appt-helix-upcoming-${i}`,
        tenantId: helixTenant.id,
        serviceId: d.serviceId,
        staffId: d.staffId,
        customerId: d.customerId,
        startTime,
        endTime,
        timezone: "America/New_York",
        duration: service.duration,
        status: AppointmentStatus.CONFIRMED,
        servicePrice: service.price,
        totalAmount: service.price,
        confirmedAt: new Date(),
        bookingReference: `UPCO${i.toString().padStart(6, "0")}`,
      },
      update: {},
    });
  }

  // ============================================================
  // TENANT 2: ClearSkin Medical Spa (second tenant for isolation demo)
  // ============================================================
  console.log("\nCreating ClearSkin Medical Spa...");

  const skinTenant = await prisma.tenant.upsert({
    where: { slug: "clearskin-spa" },
    create: {
      name: "ClearSkin Medical Spa",
      slug: "clearskin-spa",
      description: "Professional skin treatments and aesthetic procedures.",
      email: "info@clearskinspa.com",
      phone: "+1 (555) 876-5432",
      city: "Los Angeles",
      state: "CA",
      country: "US",
      timezone: "America/Los_Angeles",
      currency: "USD",
      primaryColor: "#059669",
      isPublic: true,
      isActive: true,
      autoConfirm: false, // Manual approval
    },
    update: {},
  });

  const skinOwner = await prisma.user.upsert({
    where: { email: "owner@clearskinspa.com" },
    create: {
      email: "owner@clearskinspa.com",
      name: "Dr. Priya Sharma",
      password: DEMO_PASSWORD_HASH,
      role: UserRole.OWNER,
      tenantId: skinTenant.id,
      emailVerified: new Date(),
    },
    update: { tenantId: skinTenant.id },
  });

  // Services for skin spa
  await Promise.all([
    prisma.service.upsert({
      where: { id: "service-skin-consult-001" },
      create: {
        id: "service-skin-consult-001",
        tenantId: skinTenant.id,
        name: "Skin Consultation",
        description: "Initial 1-on-1 consultation with our dermatologist.",
        duration: 30,
        bufferTime: 15,
        price: 0,
        isActive: true,
      },
      update: {},
    }),
    prisma.service.upsert({
      where: { id: "service-skin-facial-001" },
      create: {
        id: "service-skin-facial-001",
        tenantId: skinTenant.id,
        name: "HydraFacial",
        description: "3-step treatment: cleanse, extract, hydrate.",
        duration: 60,
        bufferTime: 15,
        price: 175,
        isActive: true,
      },
      update: {},
    }),
  ]);

  // Subscription for skin spa
  await prisma.subscription.upsert({
    where: { tenantId: skinTenant.id },
    create: {
      tenantId: skinTenant.id,
      stripeSubscriptionId: "sub_demo_skin_starter",
      stripeCustomerId: "cus_demo_skin",
      stripePriceId: "price_demo_starter_monthly",
      stripeProductId: "prod_demo_starter",
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.TRIALING,
      interval: "month",
      trialStart: new Date(),
      trialEnd: addDays(new Date(), 14),
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
      maxStaff: 1,
      maxBookings: 50,
      bookingsThisMonth: 3,
    },
    update: {},
  });

  console.log("\n✅ Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo Credentials");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Owner (PRO plan):   demo@bookflow.app / Demo1234");
  console.log("Admin:              admin@helixsalon.com / Demo1234");
  console.log("Skin Spa Owner:     owner@clearskinspa.com / Demo1234");
  console.log("");
  console.log("Public Booking Pages:");
  console.log("  /book/helix-hair-studio");
  console.log("  /book/clearskin-spa");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function createCustomer(
  tenantId: string,
  name: string,
  email: string,
  phone: string,
  total: number,
  completed: number,
  noShows: number,
  spent: number,
) {
  return prisma.customer.upsert({
    where: { tenantId_email: { tenantId, email } },
    create: {
      tenantId,
      name,
      email,
      phone,
      status: spent > 2000 ? "VIP" : "ACTIVE",
      totalBookings: total,
      completedBookings: completed,
      noShowCount: noShows,
      totalSpent: spent,
      lastVisitAt: subDays(new Date(), Math.floor(Math.random() * 30)),
    },
    update: {},
  });
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
