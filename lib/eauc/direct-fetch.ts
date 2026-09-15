import "server-only";

/**
 * Whether this deployment can reach setadiran, which answers Iranian IPs only.
 *
 * Off by default, because the public deployment is on Vercel and cannot: rows
 * arrive through /api/ingest, detail pages render the snapshot row, and the
 * manual sync button and cron both refuse rather than waste a request.
 *
 * Set EAUC_DIRECT_FETCH=true when hosting somewhere setadiran answers, and
 * every one of those paths switches to fetching upstream directly.
 */
export function isDirectFetchEnabled() {
  return process.env.EAUC_DIRECT_FETCH === "true";
}
