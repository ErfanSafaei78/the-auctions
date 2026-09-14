import { toPersianDigits } from "./digits";

const grouping = new Intl.NumberFormat("en-US");

/**
 * Reserve price arrives as a JSON number, so it has no upstream presentation
 * to preserve — grouping and numeral glyphs are formatting, not translation.
 */
export function formatRial(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;

  return toPersianDigits(grouping.format(value));
}

export function formatCount(value: number) {
  return toPersianDigits(grouping.format(value));
}
