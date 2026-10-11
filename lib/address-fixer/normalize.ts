/**
 * Text normalization for Israeli address matching.
 *
 * Every helper here is total: any input (null, number, object) returns a string
 * so the address fixer can never throw on malformed caller data.
 */

const INVISIBLE = /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g
const NIQQUD = /[\u0591-\u05c7]/g
const DOUBLE_QUOTE = /[\u0022\u00ab\u00bb\u201c\u201d\u201e\u201f\u05f4\u2033\u3003]/g
const SINGLE_QUOTE = /[\u0027\u2018\u2019\u201a\u201b\u05f3\u2032\u0060\u00b4]/g
const DASH = /[\u2010-\u2015\u2212\u05be\uff0d]/g
const SLASH = /[\u2044\u2215\uff0f]/g

const FINAL_LETTERS: Record<string, string> = {
  "\u05da": "\u05db", // ך -> כ
  "\u05dd": "\u05de", // ם -> מ
  "\u05df": "\u05e0", // ן -> נ
  "\u05e3": "\u05e4", // ף -> פ
  "\u05e5": "\u05e6", // ץ -> צ
}

/** Street-type words. The gov dataset stores the short form (רח, שד, סמ...). */
const PREFIX_CANON: Record<string, string> = {
  רחוב: "רח",
  רח: "רח",
  שדרות: "שד",
  שדרת: "שד",
  שדירות: "שד",
  שד: "שד",
  סמטה: "סמ",
  סמטת: "סמ",
  סימטה: "סמ",
  סימטת: "סמ",
  סמ: "סמ",
  שכונה: "שכ",
  שכונת: "שכ",
  שכ: "שכ",
  פרופסור: "פרופ",
  דוקטור: "דר",
  כיכר: "ככר",
  ככר: "ככר",
  קריית: "קרית",
  קרית: "קרית",
}

/**
 * Leading words that may be dropped when the customer added or omitted them.
 * Written with final letters already folded (דרך -> דרכ), as keys are.
 */
const DROPPABLE_PREFIXES = new Set([
  "רח",
  "שד",
  "סמ",
  "שכ",
  "דרכ",
  "שביל",
  "משעול",
  "ככר",
  "מבוא",
  "הרב",
  "רבי",
  "השר",
  "פרופ",
  "פרופסור",
  "דר",
  "דוקטור",
  "street",
  "st",
  "road",
  "rd",
])

/** Street-type / title word that does not identify a street on its own. */
export function isStreetPrefixWord(value: unknown): boolean {
  const key = normalizeKey(value)
  return DROPPABLE_PREFIXES.has(key) || DROPPABLE_PREFIXES.has(PREFIX_CANON[key] ?? "")
}

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ""
  let text: string
  if (typeof value === "string") text = value
  else if (typeof value === "number" || typeof value === "boolean") {
    text = String(value)
  } else {
    try {
      text = String(value)
    } catch {
      return ""
    }
  }
  if (!text) return ""
  try {
    text = text.normalize("NFKC")
  } catch {
    // Malformed surrogate pairs — keep the raw string.
  }
  return text
    .replace(INVISIBLE, "")
    .replace(NIQQUD, "")
    .replace(DOUBLE_QUOTE, '"')
    .replace(SINGLE_QUOTE, "'")
    .replace(DASH, "-")
    .replace(SLASH, "/")
    .replace(/\s+/g, " ")
    .trim()
}

function foldFinals(text: string) {
  let out = ""
  for (const char of text) out += FINAL_LETTERS[char] ?? char
  return out
}

/**
 * Exact-match key: case folded, final letters unified, quotes and punctuation
 * dropped, street-type words canonicalized. `רמב"ם` and `רמבם` share a key.
 */
export function normalizeKey(value: unknown): string {
  const cleaned = cleanText(value).toLowerCase()
  if (!cleaned) return ""
  const stripped = foldFinals(cleaned)
    .replace(/["']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!stripped) return ""
  return stripped
    .split(" ")
    .map((token) => PREFIX_CANON[token] ?? token)
    .join(" ")
}

/** Collapses doubled ו / י so `נווה` matches `נוה` and `נהרייה` matches `נהריה`. */
export function relaxedKey(value: unknown): string {
  const key = normalizeKey(value)
  if (!key) return ""
  return key.replace(/\u05d5{2,}/g, "\u05d5").replace(/\u05d9{2,}/g, "\u05d9")
}

/**
 * Spelling-tolerant key: drops the vowel letters א ה ו י, so `יעקב` and `יעקוב`
 * collapse to the same value. Only ever used with a uniqueness check.
 */
export function looseKey(value: unknown): string {
  const key = relaxedKey(value)
  if (!key) return ""
  return key
    .replace(/[\u05d0\u05d4\u05d5\u05d9]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokens(value: unknown): string[] {
  const key = normalizeKey(value)
  return key ? key.split(" ") : []
}

/** Word-order insensitive key: `חנה סנש` and `סנש חנה` collapse to one value. */
export function sortedKey(value: unknown): string {
  const list = tokens(value)
  if (!list.length) return ""
  return [...list].sort().join(" ")
}

export function sortedLooseKey(value: unknown): string {
  const key = looseKey(value)
  if (!key) return ""
  return key.split(" ").filter(Boolean).sort().join(" ")
}

/** Drops a leading street-type word (`רח הרצל` -> `הרצל`). */
export function withoutStreetPrefix(value: unknown): string {
  const list = tokens(value)
  if (list.length < 2) return normalizeKey(value)
  if (DROPPABLE_PREFIXES.has(list[0])) return list.slice(1).join(" ")
  return list.join(" ")
}

/** Levenshtein distance with an early exit once `max` is exceeded. */
export function editDistance(a: string, b: string, max = 4): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (Math.abs(a.length - b.length) > max) return max + 1

  let previous = new Array<number>(b.length + 1)
  let current = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) previous[j] = j

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    let rowMin = current[0]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      )
      if (current[j] < rowMin) rowMin = current[j]
    }
    if (rowMin > max) return max + 1
    const swap = previous
    previous = current
    current = swap
  }
  return previous[b.length]
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (!longest) return 0
  const distance = editDistance(a, b, longest)
  return 1 - distance / longest
}
