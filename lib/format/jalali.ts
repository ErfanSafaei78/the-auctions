import { toLatinDigits, toPersianDigits } from "./digits";

const JALALI_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})(?:[ T](\d{2}):(\d{2}))?/;

export interface JalaliParts {
  year: string;
  month: string;
  day: string;
  hour: string | null;
  minute: string | null;
}

export function parseJalaliDateTime(raw: string | null): JalaliParts | null {
  if (!raw) return null;

  const match = JALALI_PATTERN.exec(raw.trim());
  if (!match) return null;

  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour: match[4] ?? null,
    minute: match[5] ?? null,
  };
}

export function formatJalaliDate(raw: string | null) {
  const parts = parseJalaliDateTime(raw);
  if (!parts) return null;

  return toPersianDigits(`${parts.year}/${parts.month}/${parts.day}`);
}

export function formatJalaliDateTime(raw: string | null) {
  const parts = parseJalaliDateTime(raw);
  if (!parts) return null;

  const date = `${parts.year}/${parts.month}/${parts.day}`;
  const time = parts.hour && parts.minute ? ` ${parts.hour}:${parts.minute}` : "";

  return toPersianDigits(`${date}${time}`);
}

/**
 * Jalali strings are zero-padded and fixed-width, so comparing these keys
 * lexicographically is the same as comparing the dates. No calendar library
 * and no Gregorian round-trip is needed anywhere in this project.
 */
export function jalaliSortKey(raw: string | null) {
  const parts = parseJalaliDateTime(raw);
  if (!parts) return "";

  return `${parts.year}${parts.month}${parts.day}${parts.hour ?? "00"}${parts.minute ?? "00"}`;
}

/**
 * Normalizes user input like "1405/7/5" or "۱۴۰۵/۰۷/۰۵" to "140507050000".
 *
 * An optional clock time is accepted too ("1405/07/05 12:00"), which is what
 * lets a first-seen filter separate two syncs on the same day. Without one the
 * key falls back to the start of that day, or its end for a range's upper
 * bound — so a bare date still means the whole day, as the deadline filters
 * have always read it.
 */
export function jalaliInputToSortKey(input: string, endOfDay = false) {
  const latin = toLatinDigits(input);

  const match = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(
    latin.trim(),
  );
  if (!match) return null;

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const time =
    match[4] !== undefined
      ? `${match[4].padStart(2, "0")}${match[5]}`
      : endOfDay
        ? "2359"
        : "0000";

  return `${year}${month}${day}${time}`;
}

function jalaliPartsFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year").padStart(4, "0")}/${get("month").padStart(2, "0")}/${get("day").padStart(2, "0")}`;
}

/**
 * Jalali month lengths vary, so offsetting a day count is done in Gregorian
 * and converted afterwards — ICU handles the calendar, we never do the math.
 */
export function getJalaliDateInDays(offsetDays: number) {
  return jalaliPartsFor(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

/**
 * Today in Tehran, on the Persian calendar, via ICU — no dependency needed.
 * formatToParts rather than format: the formatted string can carry an era
 * suffix that would corrupt a naive split.
 *
 * Server-only. Pass the result down as a prop so deadline filtering is
 * deterministic and hydration-safe.
 */
export function getTodayJalali() {
  return jalaliPartsFor(new Date());
}

function jalaliStampFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const day = `${get("year").padStart(4, "0")}/${get("month").padStart(2, "0")}/${get("day").padStart(2, "0")}`;

  return `${day} ${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`;
}

/** Tehran-local Jalali timestamp for an instant, used to stamp a snapshot. */
export function getJalaliStamp(date: Date) {
  return jalaliStampFor(date);
}

/**
 * Formats an arbitrary instant (e.g. an ISO string from a server response)
 * as a Tehran-local Jalali stamp — used for things like "you can sync again
 * at ...", not for the current moment.
 */
export function formatJalaliInstant(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return toPersianDigits(jalaliStampFor(date));
}
