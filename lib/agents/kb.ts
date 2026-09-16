import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"
import { formatRetrievedChunks, retrieveKbChunks } from "@/lib/agents/kb-rag"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")
const pozitiveKbPath = join(process.cwd(), "lib/agents/kb/pozitive-products.md")
const carpetFaqPath = join(process.cwd(), "lib/agents/kb/carpet-products-faq.md")
const carpetTermsPath = join(process.cwd(), "lib/agents/kb/carpet-terminology.md")
const carpetSizeGuidePath = join(process.cwd(), "lib/agents/kb/carpet-size-guide.md")
const membershipPaymentsPath = join(process.cwd(), "lib/agents/kb/membership-clubs-payments.md")

/** Normal FAQ turns — match shadow eval cap (plan I). */
export const KB_CAP_NORMAL = 6000
/** Hard-case (T3) — wider policy without full 40K dump. */
export const KB_CAP_T3 = 12000

let cachedKb = ""
let cachedPozitiveKb = ""
let cachedCarpetFaqKb = ""
let cachedCarpetTermsKb = ""
let cachedCarpetSizeGuideKb = ""
let cachedMembershipPaymentsKb = ""

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

function rawCarpetSizeGuideKb() {
  if (!cachedCarpetSizeGuideKb) {
    cachedCarpetSizeGuideKb = readFileSync(carpetSizeGuidePath, "utf8")
  }
  return cachedCarpetSizeGuideKb
}

function rawMembershipPaymentsKb() {
  if (!cachedMembershipPaymentsKb) {
    cachedMembershipPaymentsKb = readFileSync(membershipPaymentsPath, "utf8")
  }
  return cachedMembershipPaymentsKb
}

export function capKbText(text: string, maxChars: number) {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  const cut = trimmed.slice(0, maxChars)
  const lastBreak = cut.lastIndexOf("\n\n")
  if (lastBreak > maxChars * 0.6) {
    return `${cut.slice(0, lastBreak).trim()}\n\n[KB truncated — use tool or ask customer to clarify if policy detail missing.]`
  }
  return `${cut.trim()}\n\n[KB truncated — use tool or ask customer to clarify if policy detail missing.]`
}

/** Membership clubs, gift cards, reloadable checkout — not generic card FAQ. */
export const MEMBERSHIP_PAYMENT_TOPIC_RE =
  /כרטיס\s+נטען|מועדון|גיפט|gift\s*card|buyme|buy\s*me|לאומי\s+בונוס|istudent|מגה\s+לאן|דולצ(?:'|׳|')?ה|דולצה|להשלים\s+הזמנ|לסגור\s+הזמנ|באמצעות\s+כרטיס|עובדי\s+צה(?:"|\״|')?ל|משרד\s+הביטחון/i

export function shouldIncludeMembershipPaymentsKb(userText = "") {
  return MEMBERSHIP_PAYMENT_TOPIC_RE.test(userText.trim())
}

/** Pozitive bean-bag product FAQ + assembly/care tutorials. */
export const POZITIVE_TOPIC_RE =
  /פוף|פופ(?:ים|צ|ס|ל)?|pozitive|pozitiveshop|bean\s*bag|pouf|הרכב(?:ה|ת)|שרינק|veluto|ולוטו|milo|מילו|riviera|ריביירה|flaffy|פלאפי|poufchik|פופצ|pinuki|פינוק|harmony|הרמונ|friendly|פרנדלי|poufale|פופל|sunpouf|סאנפ|longi|לונג|big\s*pouf|בוסט|boost|ניעור|נער(?:ו)?\s*(?:את\s)?(?:ה)?פוף|כ(?:בס|יסוי)|גשם|olefin|outdoor|מרפסת|גינה|beanbag/i

export function shouldIncludePozitiveKb(userText = "") {
  return POZITIVE_TOPIC_RE.test(userText.trim())
}

/** Carpet / rug product FAQ from carpetshop.co.il/pages/faq */
export const CARPET_FAQ_TOPIC_RE =
  /שטיח|carpet|rug|carpetshop|roomvo|הדמ(?:יה|ייה)|visualization|אריז(?:ה|ת)|פר(?:יס|וש)|נשיר|פלומ|משטח\s*נגד|איטוס|anti-?slip|מידה\s*מתאימ|הזמנה\s*באתר|שאיב|ניקוי\s*שטיח|פתיח(?:ה|ת)\s*אריז/i

const POLICY_QUESTION_RE =
  /החזר|החלפ|ביטול|returns?|refund|exchange|cancellation|מדיניות/i

function isPolicyQuestion(userText = "") {
  return POLICY_QUESTION_RE.test(userText.trim())
}

export function shouldIncludeCarpetFaqKb(userText = "") {
  if (isPolicyQuestion(userText)) return false
  return CARPET_FAQ_TOPIC_RE.test(userText.trim())
}

/** Glossary terms — require rug context (plan F: avoid false positives on classic/wool alone). */
export const CARPET_TERMINOLOGY_TERMS_RE =
  /שאגי|shaggy|קילים|kilim|פרסי|persian|אבסטרקט|abstract|מרוק|moroccan|נורד|scandin|קלאסי|classic|עבוד(?:ת|ה)\s*יד|hand\s*made|handmade|מכונה|machine\s*made|צמר|wool|היטסט|hytex|ראנר|runner|מילון|מונח|terminology|סופר\s*זיגלר|ziegler|אפגנ|afghan|אוזבק|uzbek|סומק|maroc|חבל|jute|rope|וינטג|vintage|בוהו|boho|OOAK|יחיד\s*מסוג|סוג(?:י|ים)?\s*(?:של\s*)?שטיח|קטגורי|קולקצי|איז(?:ה|ו)\s*שטיחים|כביס|ג(?:'|׳)וטה|טלאים|בהזמנה\s*אישית|שייפס|אתני|כפרי|אורבני|שבטי|רטרו|קטיפה|כלב|חתול|בעל(?:י)?\s*חיים|חיות\s*מחמד|קל\s*לניקוי|רחיץ|נעים\s*למגע|סינתטי|מחליק|אנטי\s*סליפ|יוטה|פוליאסטר|פוליפרופילן|ויסקוזה|פוליאמיד|במבוק|חדר\s*ילדים|kids[\s-]?room/i

export const CARPET_TERMINOLOGY_CONTEXT_RE =
  /שטיח|ראנר|rug|carpet|מילון\s*מונח|terminology|מה\s+(?:זה|ההבדל)|הבדל\s+בין|סוג(?:י|ים)?\s*(?:של\s*)?שטיח|קטגור/i

export function shouldIncludeCarpetTerminologyKb(userText = "") {
  const text = userText.trim()
  if (!text) return false
  if (!CARPET_TERMINOLOGY_TERMS_RE.test(text)) return false
  return CARPET_TERMINOLOGY_CONTEXT_RE.test(text)
}

/** Room-by-room size placement guide from carpetshop.co.il/pages/rug-sizes */
export const CARPET_SIZE_GUIDE_RE =
  /איז(?:ה|ו)\s*(?:גודל|מידה)|מיד(?:ה|ות)\s*(?:מתאימ|של|ל)|גודל\s*(?:שטיח|מתאים)|(?:שטיח|ראנר).{0,40}(?:לסלון|לחדר|לפינת\s*אוכל|למסדרון|למרפסת|לגינה|לכניסה)|\b\d{2,3}\s*[x×*על]\s*\d{2,3}\b|ספה\s*פינתית|כמה\s*ס"?מ/i

export function shouldIncludeCarpetSizeGuideKb(userText = "") {
  return CARPET_SIZE_GUIDE_RE.test(userText.trim())
}

function collectSupplementKb(userText: string, force = false) {
  const parts: string[] = []
  if (force || shouldIncludePozitiveKb(userText)) {
    parts.push(rawPozitiveKb())
  }
  if (force || shouldIncludeCarpetFaqKb(userText)) {
    parts.push(rawCarpetFaqKb())
  }
  if (force || shouldIncludeCarpetTerminologyKb(userText)) {
    parts.push(rawCarpetTermsKb())
  }
  if (force || shouldIncludeCarpetSizeGuideKb(userText)) {
    parts.push(rawCarpetSizeGuideKb())
  }
  if (force || shouldIncludeMembershipPaymentsKb(userText)) {
    parts.push(rawMembershipPaymentsKb())
  }
  return parts.filter(Boolean).join("\n\n")
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
    re: /תשלום|אשראי|ביט|bit|payment|מועדון|נטען|גיפט|buyme|חבר|פיס/i,
    titles: ["Payment", "Payments"],
  },
  {
    re: /3076|שירות|contact|מייל|צ(?:'|׳|')אט/i,
    titles: ["Contact", "Customer service"],
  },
  {
    re: /הדמיה|visualization|roomvo/i,
    titles: ["Visualization"],
  },
  {
    re: /trade[\s-]?in|טרייד[\s-]?א(?:ין|ון)|טרייד(?:ין|)?/i,
    titles: ["Owner-verified", "Trade-in"],
  },
  {
    re: /(?:מחיר\s+המפורסם|מחיר\s+ב(?:אתר|עמוד)|עגלה|ל(?:שלם|קופה)).{0,80}(?:מחיר|עלה|שונה)|(?:יתכן|למה).{0,30}מחיר.{0,80}(?:עלה|שונה)/i,
    titles: ["Owner-verified", "Checkout price"],
  },
]

function sectionsForText(text: string, sections: Section[]) {
  const matched = new Set<string>()
  for (const hint of SECTION_HINTS) {
    if (!hint.re.test(text)) continue
    for (const title of hint.titles) matched.add(title.toLowerCase())
  }

  if (matched.size === 0) {
    return sections.filter((s) => /refund|exchange|cancellation/i.test(s.title))
  }

  return sections.filter((s) =>
    [...matched].some((m) => s.title.toLowerCase().includes(m))
  )
}

function buildCoreFaqBody(userText: string, extraRag = "") {
  const { header, sections } = parseSections(rawKb())
  const regexPicked = sectionsForText(userText, sections)
  const regexBody =
    regexPicked.length > 0
      ? regexPicked.map((section) => section.body).join("\n\n")
      : sections
          .filter((s) => /refund|exchange|cancellation/i.test(s.title))
          .map((section) => section.body)
          .join("\n\n")

  if (!extraRag.trim()) {
    return `${header}\n\n${regexBody}`
  }
  return `${header}\n\n${regexBody}\n\n### Retrieved policy excerpts\n${extraRag}`
}

function assembleKbText(input: {
  userText: string
  tier: ModelTier | null
  forceSupplements?: boolean
  extraRag?: string
}) {
  const max = input.tier === "T3" ? KB_CAP_T3 : KB_CAP_NORMAL
  const supplements = collectSupplementKb(
    input.userText,
    input.forceSupplements ?? input.tier === "T3"
  )
  const coreBudget = Math.max(1800, max - supplements.length)
  const core = capKbText(
    buildCoreFaqBody(input.userText, input.extraRag ?? ""),
    coreBudget
  )
  if (!supplements) return capKbText(core, max)
  return capKbText(`${core}\n\n${supplements}`, max)
}

function buildFullFaqCore() {
  const { header, sections } = parseSections(rawKb())
  return `${header}\n\n${sections.map((section) => section.body).join("\n\n")}`
}

/** Full KB for hard cases (T3 / policy dispute). */
export function selectFaqKbFull() {
  const max = KB_CAP_T3
  const prioritySupplements = [rawPozitiveKb(), rawMembershipPaymentsKb()]
    .filter(Boolean)
    .join("\n\n")
  const coreBudget = Math.max(2000, max - prioritySupplements.length)
  const core = capKbText(buildFullFaqCore(), coreBudget)
  if (!prioritySupplements) return capKbText(core, max)
  return capKbText(`${core}\n\n${prioritySupplements}`, max)
}

/** Section-selective KB + hybrid RAG retrieval (plan H/I). */
export async function selectFaqKbAsync(userText = "", tier: ModelTier | null = null) {
  if (tier === "T3") return selectFaqKbFull()

  const retrieved = await retrieveKbChunks(userText, 3)
  const ragBody = formatRetrievedChunks(retrieved)
  return assembleKbText({ userText, tier, forceSupplements: false, extraRag: ragBody })
}

/** Sync wrapper — regex path only (tests + deterministic callers). */
export function selectFaqKb(userText = "", tier: ModelTier | null = null) {
  if (tier === "T3") return selectFaqKbFull()
  return assembleKbText({ userText, tier, forceSupplements: false })
}
