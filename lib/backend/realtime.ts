"use client";

import { createBrowserClient } from "@supabase/ssr";

export function subscribeToOrders(scope: { studentId: string } | { vendorId: string }, refresh: () => void) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const startPolling = (interval: number) =>
    window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, interval);
  if (!url || !key) {
    const poll = startPolling(3_000);
    return () => window.clearInterval(poll);
  }
  const client = createBrowserClient(url, key);
  const topic = "studentId" in scope ? "ap-food:student:" + scope.studentId : "ap-food:vendor:" + scope.vendorId;
  let stopped = false;
  let channel: ReturnType<typeof client.channel> | undefined;
  let poll = startPolling(3_000);
  void client.realtime
    .setAuth()
    .then(() => {
      if (stopped) return;
      channel = client
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "order_changed" }, refresh)
        .subscribe((state) => {
          if (stopped) return;
          const subscribed = state === "SUBSCRIBED";
          window.clearInterval(poll);
          // A subscribed channel can still miss individual broadcasts.
          poll = startPolling(subscribed ? 15_000 : 3_000);
          if (subscribed) refresh();
        });
    })
    .catch(() => {
      /* Scoped polling continues when the channel is unavailable. */
    });

  return () => {
    stopped = true;
    window.clearInterval(poll);
    if (channel) void client.removeChannel(channel);
  };
}
