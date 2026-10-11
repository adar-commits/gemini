/**
 * Script-agnostic consonant skeleton used to match English (transliterated)
 * input against the Hebrew street list.
 *
 * Both scripts collapse onto the same reduced alphabet: vowels disappear, and
 * letter pairs that share a sound in Hebrew transliteration (b/v, k/q/c, p/f,
 * z/ts/tz, s/sh) collapse onto one symbol. `Levi eshkol` and `לוי אשכול` both
 * become `lvskvl`-ish, close enough for a bounded edit distance check.
 */

import { cleanText } from "./normalize"

const HEBREW_SKELETON: Record<string, string> = {
  "\u05d0": "", // א
  "\u05d1": "v", // ב
  "\u05d2": "g", // ג
  "\u05d3": "d", // ד
  "\u05d4": "h", // ה
  "\u05d5": "v", // ו
  "\u05d6": "z", // ז
  "\u05d7": "h", // ח
  "\u05d8": "t", // ט
  "\u05d9": "", // י
  "\u05db": "k", // כ
  "\u05da": "k", // ך
  "\u05dc": "l", // ל
  "\u05de": "m", // מ
  "\u05dd": "m", // ם
  "\u05e0": "n", // נ
  "\u05df": "n", // ן
  "\u05e1": "s", // ס
  "\u05e2": "", // ע
  "\u05e4": "f", // פ
  "\u05e3": "f", // ף
  "\u05e6": "z", // צ
  "\u05e5": "z", // ץ
  "\u05e7": "k", // ק
  "\u05e8": "r", // ר
  "\u05e9": "s", // ש
  "\u05ea": "t", // ת
}

const LATIN_SKELETON: Record<string, string> = {
  a: "",
  e: "",
  i: "",
  o: "",
  u: "",
  y: "",
  b: "v",
  c: "k",
  d: "d",
  f: "f",
  g: "g",
  h: "h",
  j: "g",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  p: "f",
  q: "k",
  r: "r",
  s: "s",
  t: "t",
  v: "v",
  w: "v",
  x: "ks",
  z: "z",
}

const LATIN_DIGRAPHS: Array<[RegExp, string]> = [
  [/sch/g, "s"],
  [/sh/g, "s"],
  [/tsch/g, "z"],
  [/tz/g, "z"],
  [/ts/g, "z"],
  [/ch/g, "h"],
  [/kh/g, "h"],
  [/ph/g, "f"],
  [/th/g, "t"],
  [/ck/g, "k"],
  [/gh/g, "g"],
  [/qu/g, "k"],
]

/** Generic address words that carry no identifying information. */
const NOISE_WORDS = new Set([
  "street",
  "st",
  "str",
  "road",
  "rd",
  "avenue",
  "ave",
  "boulevard",
  "blvd",
  "lane",
  "drive",
  "way",
  "apt",
  "apartment",
  "flat",
  "unit",
  "floor",
  "fl",
  "entrance",
  "ent",
  "building",
  "bldg",
  "no",
  "number",
  "the",
])

export function hasLatinLetters(value: unknown): boolean {
  return /[a-z]/i.test(cleanText(value))
}

export function hasHebrewLetters(value: unknown): boolean {
  return /[\u05d0-\u05ea]/.test(cleanText(value))
}

function collapseRepeats(text: string) {
  let out = ""
  for (const char of text) {
    if (out[out.length - 1] !== char) out += char
  }
  return out
}

function wordSkeleton(word: string, vavAsVowel: boolean) {
  if (!word) return ""
  let source = word
  if (/[a-z]/.test(word)) {
    for (const [pattern, replacement] of LATIN_DIGRAPHS) {
      source = source.replace(pattern, replacement)
    }
  }
  let out = ""
  for (const char of source) {
    if (/[a-z]/.test(char)) out += LATIN_SKELETON[char] ?? ""
    else if (char === "\u05d5" && vavAsVowel) out += ""
    else if (/[\u05d0-\u05ea]/.test(char)) out += HEBREW_SKELETON[char] ?? ""
  }
  // A final ה / h is usually silent (חיפה vs Haifa).
  if (out.length > 1 && out.endsWith("h")) out = out.slice(0, -1)
  return out
}

/**
 * Reduces Hebrew or Latin text to its comparable consonant skeleton.
 * Returns "" when nothing identifying is left.
 */
export function latinSkeleton(value: unknown, options: { vavAsVowel?: boolean } = {}): string {
  const cleaned = cleanText(value).toLowerCase()
  if (!cleaned) return ""
  const words = cleaned
    .replace(/[^a-z\u05d0-\u05ea]+/g, " ")
    .split(" ")
    .filter((word) => word && !NOISE_WORDS.has(word))
  if (!words.length) return ""
  const skeleton = words
    .map((word) => wordSkeleton(word, options.vavAsVowel ?? false))
    .join("")
  return collapseRepeats(skeleton)
}

/** Strips English filler words so `20 Hatamar street` leaves `hatamar`. */
export function stripLatinNoiseWords(value: unknown): string {
  const cleaned = cleanText(value)
  if (!cleaned) return ""
  const kept = cleaned
    .split(" ")
    .filter((word) => {
      const bare = word.toLowerCase().replace(/[^a-z]/g, "")
      return !bare || !NOISE_WORDS.has(bare)
    })
    .join(" ")
  return kept.replace(/\s+/g, " ").trim() || cleaned
}
