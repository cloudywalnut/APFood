const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function requestOriginAllowed(requestUrl: string, origin: string | null, configuredOrigin: string | undefined, development: boolean) {
  if (!origin) return false;
  try {
    const target = new URL(requestUrl);
    const expected = configuredOrigin || target.origin;
    if (origin === expected) return true;
    // Local dev may be opened through either loopback hostname. Still require
    // the browser's exact request origin (including protocol and port).
    return development && origin === target.origin && loopbackHosts.has(target.hostname)
      && loopbackHosts.has(new URL(expected).hostname);
  } catch { return false; }
}
