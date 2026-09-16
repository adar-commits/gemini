/**
 * Seed hom_agent_kb_chunks from local markdown KB files.
 * Usage: npx tsx scripts/seed-kb-chunks.ts
 */
import { allLocalKbChunks } from "@/lib/agents/kb-rag"
import { getAgentSupabase } from "@/lib/agents/supabase"

async function main() {
  const chunks = allLocalKbChunks()
  const supabase = getAgentSupabase()
  const rows = chunks.map((chunk) => ({
    section_id: chunk.sectionId,
    title: chunk.title,
    content: chunk.content,
    source: chunk.source,
  }))

  const { error } = await supabase.from("hom_agent_kb_chunks").upsert(rows, {
    onConflict: "section_id",
  })
  if (error) {
    console.error("seed failed:", error.message)
    process.exit(1)
  }
  console.log(`Seeded ${rows.length} KB chunks`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
