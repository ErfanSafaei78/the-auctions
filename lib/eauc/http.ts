import { EAUC_REFERER, EAUC_USER_AGENT } from "./constants";

export type CookieJar = Map<string, string>;

/**
 * setadiran stalls rather than failing fast when it is struggling. Without a
 * ceiling, a detail page hangs until the function is killed instead of
 * rendering its error panel, and a sync burns its whole budget on one attempt.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

export interface EaucResponse {
  ok: boolean;
  status: number;
  text: string;
  contentType: string | null;
}

function parseSetCookie(header: string) {
  const part = header.split(";")[0]?.trim();
  if (!part) return null;

  const separator = part.indexOf("=");
  if (separator <= 0) return null;

  return {
    name: part.slice(0, separator),
    value: part.slice(separator + 1),
  };
}

function collectSetCookies(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export function mergeCookies(jar: CookieJar, response: Response) {
  for (const header of collectSetCookies(response)) {
    const cookie = parseSetCookie(header);
    if (cookie) {
      jar.set(cookie.name, cookie.value);
    }
  }
}

export function cookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function baseHeaders(jar: CookieJar) {
  return {
    "accept-language": "en-US,en;q=0.9,fa;q=0.8",
    "cache-control": "no-cache",
    cookie: cookieHeader(jar),
    pragma: "no-cache",
    referer: EAUC_REFERER,
    "user-agent": EAUC_USER_AGENT,
    "x-requested-with": "XMLHttpRequest",
  };
}

async function toEaucResponse(response: Response): Promise<EaucResponse> {
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text(),
    contentType: response.headers.get("content-type"),
  };
}

export async function eaucGet(
  jar: CookieJar,
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<EaucResponse> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...baseHeaders(jar),
      accept: "application/json, text/javascript, */*; q=0.01",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  mergeCookies(jar, response);
  return toEaucResponse(response);
}

export async function eaucPost(
  jar: CookieJar,
  url: string,
  body: Record<string, string>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<EaucResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...baseHeaders(jar),
      accept: "text/html, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  mergeCookies(jar, response);
  return toEaucResponse(response);
}

/**
 * The upstream answers an expired or unusable session with a Struts error page
 * rather than a status code, so content sniffing is the only reliable signal.
 */
export function looksLikeHtmlError(response: EaucResponse) {
  if (!response.ok) return true;

  const trimmed = response.text.trimStart();
  const isHtml =
    response.contentType?.includes("text/html") ||
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html");

  if (!isHtml) return false;

  return (
    response.text.includes("خطا در انجام عملیات مورد نظر") ||
    response.text.includes("home-login.action")
  );
}
