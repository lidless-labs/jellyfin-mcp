export interface JellyfinConfig {
  url: string;
  apiKey: string;
  verifySsl: boolean;
  timeout: number;
}

const DEFAULT_TIMEOUT_SECONDS = 30;

// JELLYFIN_TIMEOUT is operator-controlled, but a typo'd value used to flow
// through parseInt as NaN, which setTimeout coerces to ~1ms and every request
// then aborts instantly with a misleading timeout error. Validate and fall
// back to the default instead.
function parseTimeoutSeconds(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `jellyfin-mcp: invalid JELLYFIN_TIMEOUT "${raw}" (expected a positive number of seconds); using default ${DEFAULT_TIMEOUT_SECONDS}s`,
    );
    return DEFAULT_TIMEOUT_SECONDS;
  }
  return parsed;
}

export function getConfig(): JellyfinConfig {
  const url = process.env.JELLYFIN_URL;
  if (!url) {
    throw new Error("JELLYFIN_URL environment variable is required (e.g. http://localhost:8096)");
  }

  const apiKey = process.env.JELLYFIN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JELLYFIN_API_KEY environment variable is required. Generate one in Jellyfin: Dashboard > API Keys.",
    );
  }

  const verifySsl = process.env.JELLYFIN_VERIFY_SSL !== "false";
  const timeout = parseTimeoutSeconds(process.env.JELLYFIN_TIMEOUT) * 1000;

  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    verifySsl,
    timeout,
  };
}
