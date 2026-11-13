/**
 * Helpers to detect if the client is running inside the AP Food standalone
 * native mobile application (Capacitor WebView).
 */

export function isNativeMobile(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return Boolean(win.Capacitor?.isNativePlatform?.() || win.Capacitor || navigator.userAgent.includes("APFoodNative"));
}
