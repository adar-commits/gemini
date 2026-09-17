import { allLocalKbChunks } from "@/lib/agents/kb-rag"
import {
  embedKbDocuments,
  embeddingToPgvector,
} from "@/lib/agents/kb-embeddings"
import { getAgentSupabase } from "@/lib/agents/supabase"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const skipEmbed = process.argv.includes("--skip-embed")
  const chunks = allLocalKbChunks()
  console.log(`[seed-kb-chunks] ${chunks.length} local chunks`)

  if (dryRun) {
    console.log(chunks.slice(0, 3).map((c) => c.sectionId))
    return
  }

  const supabase = getAgentSupabase()
  const embeddings = skipEmbed
    ? []
    : await embedKbDocuments(chunks.map((chunk) => chunk.content))

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]
    const row: Record<string, unknown> = {
      section_id: chunk.sectionId,
      title: chunk.title,
      content: chunk.content,
      source: chunk.source,
    }
    if (embeddings[i]?.length) {
      row.embedding = embeddingToPgvector(embeddings[i])
    }

    const { error } = await supabase
      .from("hom_agent_kb_chunks")
      .upsert(row, { onConflict: "section_id" })
    if (error) {
      throw new Error(`upsert ${chunk.sectionId}: ${error.message}`)
    }
  }

  console.log(`[seed-kb-chunks] upserted ${chunks.length} rows`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
