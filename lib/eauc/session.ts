import { EAUC_USER_AGENT, EAUC_WELCOME_URL } from "./constants";
import { mergeCookies, REQUEST_TIMEOUT_MS, type CookieJar } from "./http";

const SESSION_TTL_MS = 20 * 60 * 1000;

interface CachedSession {
  jar: CookieJar;
  createdAt: number;
}

let cached: CachedSession | null = null;
let inFlight: Promise<CookieJar> | null = null;

export async function bootstrapEaucSession(): Promise<CookieJar> {
  const jar: CookieJar = new Map();

  const response = await fetch(EAUC_WELCOME_URL, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9,fa;q=0.8",
      "user-agent": EAUC_USER_AGENT,
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  mergeCookies(jar, response);

  if (!response.ok || jar.size === 0) {
    throw new Error(
      `Failed to bootstrap eauc session (status ${response.status}, ${jar.size} cookies).`,
    );
  }

  return jar;
}

/**
 * Serverless instances are reused, so a bootstrap per request is wasteful.
 * Concurrent callers share one in-flight bootstrap.
 */
export async function getEaucSession(options?: {
  force?: boolean;
}): Promise<CookieJar> {
  if (options?.force) {
    cached = null;
    inFlight = null;
  }

  if (cached && Date.now() - cached.createdAt < SESSION_TTL_MS) {
    return cached.jar;
  }

  if (!inFlight) {
    inFlight = bootstrapEaucSession()
      .then((jar) => {
        cached = { jar, createdAt: Date.now() };
        return jar;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/**
 * Runs `task` against a pooled session and retries once against a fresh one
 * when the response looks like an expired-session error page.
 */
export async function withEaucSession<T>(
  task: (jar: CookieJar) => Promise<T>,
  isAuthFailure: (result: T) => boolean,
): Promise<T> {
  const first = await task(await getEaucSession());
  if (!isAuthFailure(first)) return first;

  return task(await getEaucSession({ force: true }));
}
