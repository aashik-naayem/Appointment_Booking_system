import Link from "next/link";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold">Forgot your password?</h1>
      <p className="text-muted-foreground text-sm">
        Automatic password reset is not available yet. Please contact your business owner or
        BookFlow support to reset your password.
      </p>
      <Link href="/auth/login" className="text-primary text-sm font-medium hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
