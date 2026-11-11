import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "ap-food-password-recovery";
function signature(value: string) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Recovery signing key is unavailable.");
  return createHmac("sha256", key).update(value).digest("hex");
}

export async function grantRecovery(userId: string) {
  const value = userId + ":" + (Date.now() + 600_000);
  (await cookies()).set(cookieName, value + ":" + signature(value), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 600,
  });
}

export async function hasRecovery(userId: string) {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return false;
  const [id, expires, mac] = raw.split(":");
  if (id !== userId || !mac || !/^[a-f0-9]{64}$/.test(mac) || Number(expires) <= Date.now()) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(id + ":" + expires), "hex"));
}

export async function clearRecovery() { (await cookies()).delete(cookieName); }
