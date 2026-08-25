import { readFileSync } from "node:fs"
import { join } from "node:path"

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

const TOPIC_TITLES: Array<{ keys: RegExp; titles: string[] }> = [
  {
    keys: /שעות|פתוח|סניפ|כתובת|טלפון|איך\s+ליצור|contact|\*3076/i,
    titles: ["Contact", "Store hours", "Branches — השטיח האדום / shared network"],
  },
  {
    keys: /משלוח|שליח|איסוף|delivery|הובלה|מתי\s+מגיע/i,
    titles: ["Shipping policy"],
  },
  {
    keys: /החזר|החלפ|ביטול|זיכוי|return|refund|returns\.carpetshop/i,
    titles: ["Refund / exchange / cancellation policy"],
  },
  {
    keys: /תשלום|תשלומים|אשראי|bit|buyme|חבר|פיס/i,
    titles: ["Payments — from FAQ page only"],
  },
  {
    keys: /אריז|ניקוי|שטיפה|הדמי|ויזואל|roomvo|אחסון|נשירה/i,
    titles: ["FAQ page extra facts"],
  },
  {
    keys: /שכיר|השכר|rent|lease|שני\s+(?:עיצובים|דגמים)/i,
    titles: ["Carpet rental / try-before-buy"],
  },
  {
    keys: /ייעוץ|עיצוב\s+אונליין|consult/i,
    titles: ["Online consulting terms"],
  },
  { keys: /נגיש|נגישות|accessibility/i, titles: ["Accessibility"] },
  { keys: /פרטיות|privacy/i, titles: ["Privacy"] },
  {
    keys: /מבצע|הנחה|50%|1\+1|campaign/i,
    titles: ["Dated promotions — only if the customer asks about a current campaign and the date is still valid"],
  },
  { keys: /עלינו|about|מי\s+אתם|החברה/i, titles: ["About"] },
]

const ALWAYS = new Set([
  "Contact",
  "Store hours",
  "Policy URLs to include when relevant",
])

const BRANCH_SECTION = "Branches — השטיח האדום / shared network"

export function selectFaqKb(userText: string) {
  const { header, sections } = parseSections(rawKb())
  const wanted = new Set(ALWAYS)
  let topicMatched = false

  for (const topic of TOPIC_TITLES) {
    if (topic.keys.test(userText)) {
      topicMatched = true
      for (const title of topic.titles) wanted.add(title)
    }
  }

  if (/סניפ|לסניף|כתובת|branch/i.test(userText)) {
    topicMatched = true
    wanted.add(BRANCH_SECTION)
    wanted.add("Store hours")
  }

  if (/החזר|החלפ|return|exchange/i.test(userText)) {
    topicMatched = true
    wanted.add(BRANCH_SECTION)
  }

  // No keyword hit → inject full KB so vague questions still have all policies in context.
  const picked = topicMatched
    ? sections.filter((section) => wanted.has(section.title))
    : sections

  return `${header}\n\n${picked.map((section) => section.body).join("\n\n")}`
}
