import "server-only";

import { timingSafeEqual } from "node:crypto";

/** Constant-time, so response timing can't be used to recover the secret. */
export function secretMatches(candidate: string | null, expected: string) {
  if (candidate === null) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
