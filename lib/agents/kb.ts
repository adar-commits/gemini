import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"

const kbPath = join(process.cwd(), "lib/agents/kb/faq.md")
let cachedKb = ""

function rawKb() {
  if (!cachedKb) cachedKb = readFileSync(kbPath, "utf8")
  return cachedKb
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
  return `${header}\n\n${sections.map((section) => section.body).join("\n\n")}`
}

/** Section-selective KB for T1/T2 — reduces input tokens. */
export function selectFaqKb(userText = "", tier: ModelTier | null = null) {
  const { header, sections } = parseSections(rawKb())
  if (tier === "T3") return selectFaqKbFull()

  const picked = sectionsForText(userText, sections)
  const body =
    picked.length > 0
      ? picked.map((section) => section.body).join("\n\n")
      : sections.map((section) => section.body).join("\n\n")

  return `${header}\n\n${body}`
}
