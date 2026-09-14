import type { DetailField, LotItem } from "./types";

const SCRIPT_BLOCK = /<script[\s\S]*?<\/script>/gi;
const LABEL_OR_FIELD_CELL =
  /<td[^>]*class="\s*(label|field)\s*"[^>]*>([\s\S]*?)<\/td>/gi;
const INPUT_VALUE = /<(?:input|textarea)[^>]*\svalue="([^"]*)"/i;
const TEXTAREA_BODY = /<textarea[^>]*>([\s\S]*?)<\/textarea>/i;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** fromCharCode mangles astral code points; fromCodePoint throws past U+10FFFF. */
function fromCodePoint(code: number, fallback: string) {
  return code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

export function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#(\d+);/g, (match, code: string) =>
      fromCodePoint(Number(code), match),
    )
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) =>
      fromCodePoint(Number.parseInt(code, 16), match),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return ENTITIES[name.toLowerCase()] ?? match;
    });
}

function stripTags(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detail pages render as a fixed two-cell pattern:
 *   <td class="label">LABEL</td><td class="field"><input value="VALUE"></td>
 *
 * Regex is acceptable against this because the shape is rigid and stable, and
 * pulling in a DOM parser for two pages is a worse trade. An empty result is
 * a parse failure and must be surfaced, never rendered as an empty page.
 */
export function parseLabeledFields(html: string): DetailField[] {
  const body = html.replace(SCRIPT_BLOCK, "");
  const fields: DetailField[] = [];

  let pendingLabel: string | null = null;
  let match: RegExpExecArray | null;

  LABEL_OR_FIELD_CELL.lastIndex = 0;
  while ((match = LABEL_OR_FIELD_CELL.exec(body)) !== null) {
    const kind = match[1].toLowerCase();
    const cell = match[2];

    if (kind === "label") {
      const label = stripTags(cell);
      pendingLabel = label.length > 0 ? label : null;
      continue;
    }

    if (!pendingLabel) continue;

    const valueMatch = INPUT_VALUE.exec(cell);
    const textareaMatch = valueMatch ? null : TEXTAREA_BODY.exec(cell);

    const value = valueMatch
      ? decodeHtmlEntities(valueMatch[1]).trim()
      : textareaMatch
        ? stripTags(textareaMatch[1])
        : stripTags(cell);

    if (value.length > 0) {
      fields.push({ label: pendingLabel, value });
    }

    pendingLabel = null;
  }

  return fields;
}

/**
 * A few values (notably the deposit) are rendered as a bare input following a
 * caption rather than inside a label/field cell pair.
 */
export function extractValueAfterCaption(html: string, caption: string) {
  const index = html.indexOf(caption);
  if (index < 0) return null;

  const match = INPUT_VALUE.exec(html.slice(index, index + 800));
  if (!match) return null;

  const value = decodeHtmlEntities(match[1]).trim();
  return value.length > 0 ? value : null;
}

export function parseLotItems(payload: unknown): LotItem[] {
  if (typeof payload !== "object" || payload === null) return [];

  const { gridModel } = payload as { gridModel?: unknown };
  if (!Array.isArray(gridModel)) return [];

  return gridModel.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const unit = row.itemUnit as { name?: unknown } | null;
    const group = row.itemGroup as { name?: unknown } | null;

    return {
      title: typeof row.title === "string" ? row.title.trim() : "",
      amount:
        typeof row.amount === "number"
          ? String(row.amount)
          : typeof row.amount === "string"
            ? row.amount
            : "",
      unit: typeof unit?.name === "string" ? unit.name : "",
      group: typeof group?.name === "string" ? group.name : "",
    };
  });
}
