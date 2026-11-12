import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// This command changes image fields only. It never resets a vendor's menu,
// prices, stock or an image supplied after the bundled photo was installed.
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("supabase/fixtures/menu-images.json", root), "utf8"));
const apply = process.argv.includes("--apply");
const project = process.env.AP_FOOD_DEMO_PROJECT_REF;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!project || !url || new URL(url).hostname !== `${project}.supabase.co` || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error("Configure the dedicated demo project and server key in ignored local configuration.");
}
const ids = manifest.map((entry) => entry.itemId);
if (new Set(ids).size !== ids.length) throw new Error("The image manifest contains duplicate menu IDs.");
for (const entry of manifest) {
  if (!/^\/food\/menu\/[a-z0-9-]+\.jpg$/.test(entry.image)) throw new Error("Unexpected bundled image path.");
  const bytes = await readFile(new URL("public" + entry.image, root));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error(`Bundled photo failed verification: ${entry.itemId}`);
  }
}
const api = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: items, error } = await api.from("menu_items").select("id,vendor_id,name,image").not("id", "like", "cancel-check-%");
if (error) throw new Error("Cannot read menu catalogue: " + error.code);
const mapped = new Map(manifest.map((entry) => [entry.itemId, entry]));
const missing = items.filter((item) => !mapped.has(item.id));
if (missing.length) throw new Error("Add images for unmapped menu IDs first: " + missing.map((item) => item.id).join(", "));
const updates = [];
for (const item of items) {
  const entry = mapped.get(item.id);
  if (item.vendor_id !== entry.vendorId || item.name !== entry.name) throw new Error(`Catalogue changed: ${item.id}`);
  if (item.image === entry.image) continue;
  if (item.image?.trim()) continue; // Preserve vendor-supplied photos.
  updates.push({ ...item, nextImage: entry.image });
}
if (apply) {
  // The backup contains catalogue image values only, never credentials.
  const backup = new URL(`.env.menu-image-backup-${Date.now()}.json`, root);
  await writeFile(backup, JSON.stringify({ project, items }, null, 2), { mode: 0o600 });
  for (const item of updates) {
    let query = api.from("menu_items").update({ image: item.nextImage }).eq("id", item.id).eq("vendor_id", item.vendor_id).eq("name", item.name);
    query = item.image === null ? query.is("image", null) : query.eq("image", item.image);
    const { data, error: updateError } = await query.select("id");
    if (updateError || data?.length !== 1) throw new Error(`Image changed concurrently or could not save: ${item.id}`);
  }
}
const { data: verified, error: verifyError } = await api.from("menu_items").select("id,image").not("id", "like", "cancel-check-%");
if (verifyError) throw new Error("Cannot verify menu images: " + verifyError.code);
console.log(JSON.stringify({ project, applied: apply, totalItems: items.length, pendingImages: updates.length,
  imagesPresent: verified.filter((item) => item.image?.trim()).length,
  assetDirectory: fileURLToPath(new URL("public/food/menu/", root)) }, null, 2));
