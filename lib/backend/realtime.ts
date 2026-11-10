"use client";

import { createBrowserClient } from "@supabase/ssr";

export function subscribeToOrders(
  scope: { studentId: string } | { vendorId: string },
  refresh: () => void,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The hosted demo has not been connected yet.");
  const client = createBrowserClient(url, key);
  const topic = "studentId" in scope ? "ap-food:student:" + scope.studentId : "ap-food:vendor:" + scope.vendorId;
  let stopped = false;
  let channel: ReturnType<typeof client.channel> | undefined;
  const startPolling = () => window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3_000);
  let poll: number | undefined = startPolling();
  void client.realtime.setAuth().then(() => {
    if (stopped) return;
    channel = client.channel(topic, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, refresh)
      .subscribe(state => {
        if (stopped) return;
        if (state === "SUBSCRIBED") {
          if (poll !== undefined) window.clearInterval(poll);
          poll = undefined;
          refresh();
        } else if (poll === undefined) poll = startPolling();
      });
  }).catch(() => { /* Scoped polling continues when the channel is unavailable. */ });

  return () => {
    stopped = true;
    if (poll !== undefined) window.clearInterval(poll);
    if (channel) void client.removeChannel(channel);
  };
}
