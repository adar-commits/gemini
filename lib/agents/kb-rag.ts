import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  chunkMarkdownBySection,
  scoreChunkForQuery,
  type KbChunk,
} from "@/lib/agents/kb-chunker"
import { getAgentSupabase } from "@/lib/agents/supabase"

const kbDir = join(process.cwd(), "lib/agents/kb")

const LOCAL_KB_FILES = [
  "faq.md",
  "pozitive-products.md",
  "carpet-products-faq.md",
  "carpet-terminology.md",
  "carpet-size-guide.md",
  "membership-clubs-payments.md",
] as const

let localChunks: KbChunk[] | null = null
let remoteChunksLoaded = false
let remoteChunks: KbChunk[] = []

function loadLocalChunks() {
  if (localChunks) return localChunks
  localChunks = []
  for (const file of LOCAL_KB_FILES) {
    const markdown = readFileSync(join(kbDir, file), "utf8")
    localChunks.push(...chunkMarkdownBySection(markdown, file.replace(/\.md$/, "")))
  }
  return localChunks
}

async function loadRemoteChunks() {
  if (remoteChunksLoaded) return remoteChunks
  remoteChunksLoaded = true
  try {
    const supabase = getAgentSupabase()
    const { data } = await supabase
      .from("hom_agent_kb_chunks")
      .select("section_id, title, content, source")
      .limit(500)
    if (!data?.length) return remoteChunks
    remoteChunks = data.map((row) => ({
      sectionId: String(row.section_id),
      title: String(row.title ?? ""),
      content: String(row.content ?? ""),
      source: String(row.source ?? "faq"),
    }))
  } catch {
    remoteChunks = []
  }
  return remoteChunks
}

export async function retrieveKbChunks(userText: string, limit = 3) {
  const remote = await loadRemoteChunks()
  const pool = remote.length > 0 ? remote : loadLocalChunks()
  const query = userText.trim()
  if (!query) return []

  const scored = pool
    .map((chunk) => ({ chunk, score: scoreChunkForQuery(chunk, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((entry) => entry.chunk)
}

export function formatRetrievedChunks(chunks: KbChunk[]) {
  if (chunks.length === 0) return ""
  return chunks.map((chunk) => chunk.content.trim()).join("\n\n")
}

/** Build all chunks for DB seed script. */
export function allLocalKbChunks() {
  return loadLocalChunks()
}
