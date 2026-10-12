import Link from "next/link";

export const metadata = { title: "Sign-in error" };

const MESSAGES: Record<string, string> = {
  AccessDenied: "You do not have access to sign in with this account.",
  Configuration:
    "We couldn't complete sign-in because of a server problem (often the database is unreachable). Please try again shortly.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  AccountLocked: "Too many failed attempts. The account is locked for 15 minutes.",
  Verification: "The sign-in link is no longer valid.",
  CredentialsSignin: "Invalid email or password.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = (error && MESSAGES[error]) ?? "Something went wrong while signing you in.";

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold">Sign-in error</h1>
      <p className="text-muted-foreground text-sm">{message}</p>
      <Link href="/auth/login" className="text-primary text-sm font-medium hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
