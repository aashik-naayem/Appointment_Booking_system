import { CredentialsSignin } from "next-auth";

/**
 * Auth.js only forwards errors that extend `CredentialsSignin` to the browser
 * (as `result.error === "CredentialsSignin"` plus `result.code`). Any other
 * error thrown from `authorize()` is collapsed into the opaque "Configuration"
 * error, which is why the old `throw new Error("AccountLocked")` could never be
 * recognised by the login page.
 */
export class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}
