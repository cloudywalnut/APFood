import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BackendError, unwrap } from "./errors";
import type { RequestClient } from "./supabase";
import { isAllowedRequestOrigin, parseAllowedOrigins } from "./supabase";
import { clearRecovery, hasRecovery } from "./recovery";

export function privilegedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new BackendError(503, "AUTH_UNCONFIGURED", "Account services are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function safeReturnPath(value: string | null) {
  return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) ? value : "/app";
}

export function appOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (originHeader && isAllowedRequestOrigin(request)) {
    return originHeader;
  }
  const configured = parseAllowedOrigins(process.env.AP_FOOD_APP_ORIGIN);
  if (configured.length > 0) {
    const first = configured.find((entry) => !entry.includes("*")) || configured[0];
    return /^https?:\/\//i.test(first) ? first : "https://" + first;
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function authLimit(request: Request, action: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new BackendError(503, "AUTH_UNCONFIGURED", "Account services are not configured.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = createHmac("sha256", secret)
    .update(action + ":" + ip)
    .digest("hex");
  const allowed = unwrap(
    await privilegedClient().rpc("consume_auth_request", {
      p_key: key,
      p_limit: action === "login" ? 30 : 5,
      p_seconds: action === "login" ? 900 : 3600,
    }),
  );
  if (!allowed) throw new BackendError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
}

const email = z.object({ email: z.email() }).strict();
const registration = email
  .extend({ displayName: z.string().trim().min(1).max(80), password: z.string().min(12).max(128) })
  .strict();
const profile = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    email: z.email().optional(),
    password: z.string().min(12).max(128).optional(),
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.displayName || value.email || value.password));

export async function authAction(request: Request, action: string, client: RequestClient) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BackendError(400, "INVALID_INPUT", "Review the form fields.");
  }
  const origin = appOrigin(request);
  const confirmationUrl = origin + "/auth/callback?next=/app";
  if (action === "register") {
    await authLimit(request, action);
    const data = registration.parse(input);
    const result = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.displayName }, emailRedirectTo: confirmationUrl },
    });
    if (result.error)
      throw new BackendError(
        400,
        "SIGNUP_FAILED",
        "We could not send the confirmation. Check your details or try signing in.",
      );
    return { ok: true };
  }
  if (action === "resend" || action === "recover") {
    await authLimit(request, action);
    const data = email.parse(input);
    const result =
      action === "resend"
        ? await client.auth.resend({ type: "signup", email: data.email, options: { emailRedirectTo: confirmationUrl } })
        : await client.auth.resetPasswordForEmail(data.email, {
            redirectTo: origin + "/auth/callback?next=/auth/reset-password",
          });
    if (result.error && !["user_not_found", "email_not_confirmed"].includes(result.error.code ?? "")) {
      throw new BackendError(400, "EMAIL_FAILED", "The email could not be sent. Try again later.");
    }
    return { ok: true };
  }
  if (action === "profile") {
    const data = profile.parse(input);
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
    if (data.displayName) unwrap(await client.rpc("update_profile", { p_name: data.displayName }));
    if (data.email || data.password) {
      const recovery = await hasRecovery(auth.user.id);
      if (!recovery && !data.currentPassword)
        throw new BackendError(400, "CURRENT_PASSWORD_REQUIRED", "Enter your current password.");
      if (data.currentPassword) {
        const verifier = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const verified = await verifier.auth.signInWithPassword({
          email: auth.user.email!,
          password: data.currentPassword,
        });
        if (verified.error) throw new BackendError(400, "UPDATE_FAILED", "Check your current password.");
      }
      const result = await client.auth.updateUser(
        {
          ...(data.email ? { email: data.email } : {}),
          ...(data.password ? { password: data.password } : {}),
          ...(data.currentPassword ? { current_password: data.currentPassword } : {}),
        },
        { emailRedirectTo: confirmationUrl },
      );
      if (result.error)
        throw new BackendError(
          400,
          "UPDATE_FAILED",
          "Check your current password or request a new password reset link.",
        );
      if (data.password) await clearRecovery();
    }
    return { ok: true };
  }
  throw new BackendError(404, "NOT_FOUND", "Endpoint unavailable.");
}
