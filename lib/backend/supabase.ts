import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { BackendError } from "./errors";

export async function requestClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new BackendError(503, "BACKEND_UNCONFIGURED", "The hosted demo has not been connected yet.");
  const auth = request.headers.get("authorization");
  if (auth) {
    const match = /^Bearer (\S+)$/i.exec(auth);
    if (!match) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + match[1] } },
    });
    const result = await client.auth.getUser(match[1]);
    if (!result.data.user || result.error) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return client;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    const allowed = process.env.AP_FOOD_APP_ORIGIN || new URL(request.url).origin;
    if (request.headers.get("origin") !== allowed) throw new BackendError(403, "FORBIDDEN", "Request origin is not allowed.");
  }
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}

export type RequestClient = Awaited<ReturnType<typeof requestClient>>;
