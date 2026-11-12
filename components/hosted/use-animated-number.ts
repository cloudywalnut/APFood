"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(
  target: number,
  enabled = true,
  durationMs = 950,
  resetKey?: string | number,
  replayKey?: string | number,
) {
  const initial = enabled && replayKey !== undefined ? 0 : target;
  const [value, setValue] = useState(initial);
  const currentRef = useRef(initial);
  const prevResetKey = useRef(resetKey);
  const prevReplayKey = useRef(replayKey);

  useEffect(() => {
    const replay = prevReplayKey.current !== replayKey;
    prevReplayKey.current = replayKey;
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey;
      currentRef.current = target;
      setValue(target);
      return;
    }
    if (!enabled || typeof window === "undefined") {
      currentRef.current = target;
      setValue(target);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      currentRef.current = target;
      setValue(target);
      return;
    }
    const start = replay ? 0 : currentRef.current;
    if (replay) {
      currentRef.current = 0;
      setValue(0);
    }
    const diff = target - start;
    if (Math.abs(diff) < 0.001) {
      currentRef.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + diff * eased;
      currentRef.current = next;
      setValue(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else {
        currentRef.current = target;
        setValue(target);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, enabled, durationMs, resetKey, replayKey]);

  return value;
}
