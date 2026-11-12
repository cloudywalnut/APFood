import { z } from "zod";
import { id, membership, orderId } from "./contracts";
import { BackendError, unwrap } from "./errors";
import { appOrigin, privilegedClient } from "./auth";
import type { RequestClient } from "./supabase";

const management = z
  .object({
    status: z.enum(["active", "suspended"]),
    memberships: z.array(membership).min(1).max(20),
    reason: z.string().trim().min(1).max(250),
  })
  .strict();
export async function manageAccount(request: Request, client: RequestClient, userId: string) {
  const input = management.parse(await request.json());
  unwrap(
    await client.rpc("manage_account", {
      p_user: orderId.parse(userId),
      p_status: input.status,
      p_memberships: input.memberships,
      p_reason: input.reason,
    }),
  );
  return { ok: true };
}

export async function inviteAccount(request: Request, client: RequestClient) {
  const input = z
    .object({
      email: z.email(),
      displayName: z.string().trim().min(1).max(80),
      role: z.enum(["student", "vendor", "admin"]),
      vendorId: id.nullable(),
    })
    .strict()
    .refine((data) => (data.role === "vendor") === (data.vendorId !== null))
    .parse(await request.json());
  const existing = unwrap(await client.rpc("list_accounts", { p_search: input.email }));
  if (existing.users?.some((user: { email: string }) => user.email.toLowerCase() === input.email.toLowerCase())) {
    throw new BackendError(409, "ACCOUNT_EXISTS", "This account already exists. Update its access from the user list.");
  }
  const result = await privilegedClient().auth.admin.inviteUserByEmail(input.email, {
    data: { display_name: input.displayName },
    redirectTo: appOrigin(request) + "/auth/callback?next=/auth/accept-invite",
  });
  if (result.error || !result.data.user)
    throw new BackendError(
      400,
      "INVITE_FAILED",
      "The invitation could not be sent. Check the email service configuration.",
    );
  unwrap(
    await client.rpc("manage_account", {
      p_user: result.data.user.id,
      p_status: "active",
      p_reason: "Staff invitation",
      p_memberships: [
        { role: "student", vendor_id: null },
        ...(input.role === "student" ? [] : [{ role: input.role, vendor_id: input.vendorId }]),
      ],
    }),
  );
  return { ok: true };
}

export function qrUrl(client: RequestClient, path: string | null) {
  return path ? client.storage.from("vendor-qr").getPublicUrl(path).data.publicUrl : null;
}

export async function uploadVendorQr(request: Request, client: RequestClient, vendorId: string) {
  const data = await request.formData();
  const file = data.get("qr");
  const name = z.string().trim().min(1).max(100).parse(data.get("merchantName"));
  if (!(file instanceof File) || file.size < 12 || file.size > 2 * 1024 * 1024) {
    throw new BackendError(400, "INVALID_IMAGE", "Choose a PNG, JPEG, or WebP image up to 2 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const format = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? { ext: "png", type: "image/png" }
    : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      ? { ext: "jpg", type: "image/jpeg" }
      : buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"
        ? { ext: "webp", type: "image/webp" }
        : null;
  if (!format || format.type !== file.type)
    throw new BackendError(400, "INVALID_IMAGE", "The file must be a PNG, JPEG, or WebP image.");
  const path = vendorId + "/" + crypto.randomUUID() + "." + format.ext;
  const uploaded = await client.storage
    .from("vendor-qr")
    .upload(path, buffer, { contentType: format.type, upsert: false });
  if (uploaded.error) throw new BackendError(400, "UPLOAD_FAILED", "The QR image could not be uploaded.");
  try {
    unwrap(await client.rpc("save_vendor_payment", { p_vendor: vendorId, p_name: name, p_path: path }));
  } catch (error) {
    await privilegedClient().storage.from("vendor-qr").remove([path]);
    throw error;
  }
  return { ok: true };
}
