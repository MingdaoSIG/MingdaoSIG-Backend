import axios from "axios";


const CACHE_TTL_MS = 10 * 60 * 1000;
// After a failed fetch, wait this long before asking GitHub again.
const FAILURE_RETRY_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;

export type OnlineAppVersion = {
  mainVersion: string | null;
  developmentVersion: string | null;
};

let cached: OnlineAppVersion = { mainVersion: null, developmentVersion: null };
// 0 until the first fetch attempt has finished.
let nextFetchAt = 0;
let inFlight: Promise<OnlineAppVersion> | undefined;

/**
 * Latest package.json versions on the main and development branches.
 *
 * Cached for 10 minutes. Never throws: when GitHub is slow or down it returns
 * the last known values, or null for a version it never fetched. A stale
 * value is returned at once while a refresh runs in the background; only a
 * call made before the first fetch attempt has finished waits for GitHub (at
 * most REQUEST_TIMEOUT_MS).
 */
export default async function GetOnlineAppVersion(): Promise<OnlineAppVersion> {
  if (Date.now() < nextFetchAt) return cached;

  const refresh = refreshVersions();
  return nextFetchAt === 0 ? await refresh : cached;
}

// Warm the cache at startup so the first /ping does not wait for GitHub.
export function prefetchOnlineAppVersion() {
  refreshVersions();
}

function refreshVersions() {
  if (!inFlight) {
    inFlight = (async () => {
      const [main, development] = await Promise.allSettled([
        getBranchVersion("main"),
        getBranchVersion("development")
      ]);
      const ok =
        main.status === "fulfilled" && development.status === "fulfilled";

      cached = {
        mainVersion:
          main.status === "fulfilled" ? main.value : cached.mainVersion,
        developmentVersion:
          development.status === "fulfilled"
            ? development.value
            : cached.developmentVersion
      };
      nextFetchAt = Date.now() + (ok ? CACHE_TTL_MS : FAILURE_RETRY_MS);
      return cached;
    })().finally(() => {
      inFlight = undefined;
    });
  }
  return inFlight;
}

async function getBranchVersion(branch: "main" | "development") {
  const API_URL = `https://raw.githubusercontent.com/MingdaoSIG/MingdaoSIG-Backend/${branch}/package.json`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await axios.get(API_URL, {
    headers,
    timeout: REQUEST_TIMEOUT_MS,
    // `timeout` only starts once the request has a socket. Behind an HTTPS
    // proxy, axios first opens a CONNECT tunnel, and a proxy that never
    // answers would stall the first /ping forever; the signal bounds it.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const version = response.data?.version;
  if (!version) throw new Error("Empty response object");

  return String(version);
}
