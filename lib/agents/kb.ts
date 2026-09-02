import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")
const pozitiveKbPath = join(process.cwd(), "lib/agents/kb/pozitive-products.md")
const carpetFaqPath = join(process.cwd(), "lib/agents/kb/carpet-products-faq.md")
const carpetTermsPath = join(process.cwd(), "lib/agents/kb/carpet-terminology.md")
let cachedKb = ""
let cachedPozitiveKb = ""
let cachedCarpetFaqKb = ""
let cachedCarpetTermsKb = ""

function rawKb() {
  if (!cachedKb) cachedKb = readFileSync(kbPath, "utf8")
  return cachedKb
}

function rawPozitiveKb() {
  if (!cachedPozitiveKb) cachedPozitiveKb = readFileSync(pozitiveKbPath, "utf8")
  return cachedPozitiveKb
}

function rawCarpetFaqKb() {
  if (!cachedCarpetFaqKb) cachedCarpetFaqKb = readFileSync(carpetFaqPath, "utf8")
  return cachedCarpetFaqKb
}

function rawCarpetTermsKb() {
  if (!cachedCarpetTermsKb) cachedCarpetTermsKb = readFileSync(carpetTermsPath, "utf8")
  return cachedCarpetTermsKb
}

/** Pozitive bean-bag product FAQ + assembly/care tutorials. */
export const POZITIVE_TOPIC_RE =
  /פוף|פופ(?:ים|צ|ס|ל)?|pozitive|pozitiveshop|bean\s*bag|pouf|הרכב(?:ה|ת)|שרינק|veluto|ולוטו|milo|מילו|riviera|ריביירה|flaffy|פלאפי|poufchik|פופצ|pinuki|פינוק|harmony|הרמונ|friendly|פרנדלי|poufale|פופל|sunpouf|סאנפ|longi|לונג|big\s*pouf|בוסט|boost|ניעור|נער(?:ו)?\s*(?:את\s)?(?:ה)?פוף|כ(?:בס|יסוי)|גשם|olefin|outdoor|מרפסת|גינה|beanbag/i

export function shouldIncludePozitiveKb(userText = "") {
  return POZITIVE_TOPIC_RE.test(userText.trim())
}

function withPozitiveKb(base: string, userText: string, force = false) {
  if (!force && !shouldIncludePozitiveKb(userText)) return base
  return `${base.trim()}\n\n${rawPozitiveKb()}`
}

/** Carpet / rug product FAQ from carpetshop.co.il/pages/faq */
export const CARPET_FAQ_TOPIC_RE =
  /שטיח|carpet|rug|carpetshop|roomvo|הדמ(?:יה|ייה)|visualization|אריז(?:ה|ת)|פר(?:יס|וש)|נשיר|פלומ|משטח\s*נגד|איטוס|anti-?slip|מידה\s*מתאימ|הזמנה\s*באתר|שאיב|ניקוי\s*שטיח|פתיח(?:ה|ת)\s*אריז/i

export function shouldIncludeCarpetFaqKb(userText = "") {
  return CARPET_FAQ_TOPIC_RE.test(userText.trim())
}

/** Glossary — explain terms only; not purchase advice. */
export const CARPET_TERMINOLOGY_RE =
  /שאגי|shaggy|קילים|kilim|פרסי|persian|אבסטרקט|abstract|מרוק|moroccan|נורד|scandin|קלאסי|classic|עבוד(?:ת|ה)\s*יד|hand\s*made|handmade|מכונה|machine\s*made|צמר|wool|היטסט|hytex|ראנר|runner|מילון|מונח|terminology|סופר\s*זיגלר|ziegler|אפגנ|afghan|אוזבק|uzbek|סומק|maroc|חבל|jute|rope|וינטג|vintage|בוהו|boho|OOAK|יחיד\s*מסוג/i

export function shouldIncludeCarpetTerminologyKb(userText = "") {
  return CARPET_TERMINOLOGY_RE.test(userText.trim())
}

function withCarpetKb(base: string, userText: string, force = false) {
  let next = base
  if (force || shouldIncludeCarpetFaqKb(userText)) {
    next = `${next.trim()}\n\n${rawCarpetFaqKb()}`
  }
  if (force || shouldIncludeCarpetTerminologyKb(userText)) {
    next = `${next.trim()}\n\n${rawCarpetTermsKb()}`
  }
  return next
}

type Section = { title: string; body: string }

function parseSections(markdown: string): { header: string; sections: Section[] } {
  const parts = markdown.split(/^## /m)
  const header = (parts.shift() ?? "").trim()
  const sections = parts.map((part) => {
    const newline = part.indexOf("\n")
    const title = (newline === -1 ? part : part.slice(0, newline)).trim()
    const body = `## ${part.trim()}`
    return { title, body }
  })
  return { header, sections }
}

const SECTION_HINTS: Array<{ re: RegExp; titles: string[] }> = [
  {
    re: /סני[פף]|שעות|פתוח|כתובת|קריית|איירפורט|branch/i,
    titles: ["Branches"],
  },
  {
    re: /החזר|החלפ|ביטול|לא\s+מרוצ|14\s+יום|returns/i,
    titles: ["Returns", "Exchange", "Cancellation"],
  },
  {
    re: /משלוח|שילוח|delivery|shipping/i,
    titles: ["Shipping", "Delivery"],
  },
  {
    re: /תשלום|אשראי|ביט|bit|payment/i,
    titles: ["Payment"],
  },
  {
    re: /3076|שירות|contact|מייל|צ(?:'|׳|)אט/i,
    titles: ["Contact", "Customer service"],
  },
  {
    re: /הדמיה|visualization|roomvo/i,
    titles: ["Visualization"],
  },
]

function sectionsForText(text: string, sections: Section[]) {
  const matched = new Set<string>()
  for (const hint of SECTION_HINTS) {
    if (!hint.re.test(text)) continue
    for (const title of hint.titles) matched.add(title.toLowerCase())
  }

  if (matched.size === 0) {
    return sections.filter((s) =>
      /branch|refund|exchange|return|shipping|contact|payment/i.test(s.title)
    )
  }

  return sections.filter((s) =>
    [...matched].some((m) => s.title.toLowerCase().includes(m))
  )
}

/** Full KB for hard cases (T3 / policy dispute). */
export function selectFaqKbFull() {
  const { header, sections } = parseSections(rawKb())
  const base = `${header}\n\n${sections.map((section) => section.body).join("\n\n")}`
  return withCarpetKb(withPozitiveKb(base, "", true), "", true)
}

/** Section-selective KB for T1/T2 — reduces input tokens. */
export function selectFaqKb(userText = "", tier: ModelTier | null = null) {
  if (tier === "T3") return selectFaqKbFull()

  const { header, sections } = parseSections(rawKb())
  const picked = sectionsForText(userText, sections)
  const body =
    picked.length > 0
      ? picked.map((section) => section.body).join("\n\n")
      : sections.map((section) => section.body).join("\n\n")

  return withCarpetKb(withPozitiveKb(`${header}\n\n${body}`, userText), userText)
}
