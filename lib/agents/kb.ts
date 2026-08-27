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

/** v2: always inject full verified KB (owner rule). */
export function selectFaqKb(_userText = "") {
  const { header, sections } = parseSections(rawKb())
  return `${header}\n\n${sections.map((section) => section.body).join("\n\n")}`
}
