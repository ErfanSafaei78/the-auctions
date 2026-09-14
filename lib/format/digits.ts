const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string) {
  return input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * Accepts both Persian (۰-۹) and Arabic-Indic (٠-٩) numerals — an iOS Persian
 * keyboard emits the latter — so a typed filter matches upstream ids either way.
 */
export function toLatinDigits(input: string) {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
