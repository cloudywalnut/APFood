"use client";

import { useEffect, useState } from "react";
import type { Preferences } from "./types";

export const defaultPreferences: Preferences = { density: "comfortable", localTimezone: false, inAppUpdates: true };
const preferencesName = "ap_food_preferences";
const choiceName = "ap_food_cookie_choice";
const eventName = "ap-preferences";
let visitPreferences = { ...defaultPreferences };

function cookie(name: string): unknown {
  if (typeof document === "undefined") return undefined;
  try {
    const value = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(name + "="))
      ?.slice(name.length + 1);
    return value ? JSON.parse(decodeURIComponent(value)) : undefined;
  } catch {
    return undefined;
  }
}
function storeCookie(name: string, value: unknown, maxAge = 60 * 60 * 24 * 180) {
  document.cookie =
    name +
    "=" +
    encodeURIComponent(JSON.stringify(value)) +
    "; Path=/; SameSite=Lax; Max-Age=" +
    maxAge +
    (location.protocol === "https:" ? "; Secure" : "");
}
export function readCookieChoice() {
  const choice = cookie(choiceName);
  return typeof choice === "object" &&
    choice !== null &&
    "version" in choice &&
    choice.version === 1 &&
    "preferences" in choice &&
    typeof choice.preferences === "boolean"
    ? { preferences: choice.preferences }
    : undefined;
}
function validate(value: unknown): Preferences {
  const input = typeof value === "object" && value !== null ? (value as Partial<Preferences>) : {};
  return {
    density: input.density === "compact" ? "compact" : "comfortable",
    localTimezone: input.localTimezone === true,
    inAppUpdates: input.inAppUpdates !== false,
  };
}
export function readPreferences(): Preferences {
  const choice = readCookieChoice();
  if (choice?.preferences) return validate(cookie(preferencesName) ?? visitPreferences);
  return visitPreferences;
}
export function savePreferences(value: Preferences) {
  visitPreferences = validate(value);
  if (readCookieChoice()?.preferences) storeCookie(preferencesName, visitPreferences);
  document.documentElement.dataset.density = visitPreferences.density;
  window.dispatchEvent(new Event(eventName));
}
export function choosePreferenceCookies(allow: boolean) {
  visitPreferences = readPreferences();
  storeCookie(choiceName, { version: 1, preferences: allow });
  storeCookie(preferencesName, allow ? visitPreferences : {}, allow ? 60 * 60 * 24 * 180 : 0);
  window.dispatchEvent(new Event(eventName));
}
export function usePreferences() {
  const [value, setValue] = useState<Preferences>(defaultPreferences);
  useEffect(() => {
    const refresh = () => {
      const next = readPreferences();
      setValue(next);
      document.documentElement.dataset.density = next.density;
    };
    refresh();
    window.addEventListener(eventName, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return [value, savePreferences] as const;
}
