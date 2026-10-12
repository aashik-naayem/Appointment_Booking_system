import Link from "next/link";

export const metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold">Account suspended</h1>
        <p className="text-muted-foreground">
          This business account is currently inactive. Please contact BookFlow support to restore
          access.
        </p>
        <Link href="/" className="text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
