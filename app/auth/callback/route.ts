import { NextResponse } from "next/server";
import { requestClient } from "../../../lib/backend/supabase";
import { safeReturnPath } from "../../../lib/backend/auth";
import type { EmailOtpType } from "@supabase/supabase-js";
import { grantRecovery } from "../../../lib/backend/recovery";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));
  const client = await requestClient(request);
  const code = url.searchParams.get("code");
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supported = ["signup", "invite", "recovery", "email_change", "email"];
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : hash && type && supported.includes(type)
      ? await client.auth.verifyOtp({ token_hash: hash, type: type as EmailOtpType })
      : undefined;
  const destination =
    result && !result.error
      ? type === "invite"
        ? "/auth/accept-invite"
        : type === "recovery"
          ? "/auth/reset-password"
          : next
      : "/auth/verify-email?error=expired";
  if (hash && result?.data.user && !result.error && (type === "recovery" || type === "invite")) {
    await grantRecovery(result.data.user.id);
  }
  return NextResponse.redirect(new URL(destination, url.origin));
}
