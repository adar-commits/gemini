# Agent knowledge base (KB)

Markdown files in this directory are injected into the HoM / Gemini agent prompt. Policy facts should match the live Carpet Shop / Pozitive **main** pages.

## Auto-refetch (standing sync)

| File | Purpose |
|------|---------|
| `sources.yaml` | Versioned list of live URLs → KB section targets |
| `sources.lock.json` | Last fetched content hash + stamp per source |
| `.sync-drafts/` | Curated bullet drafts when live pages change (PR review) |

**Runner:** `.github/workflows/kb-sync.yml` — weekday ~08:00 Asia/Jerusalem change-detect, plus manual dispatch.

**Write model:** diff → PR to `main` only. Never silent overwrite. Tier 1 legal/policy pages are **not** auto-merged.

### Local commands

```bash
# Dry-run all Tier 1 sources (default)
npx tsx scripts/kb-sync.ts --dry-run

# Single source
npx tsx scripts/kb-sync.ts --dry-run --id=carpet-shipping

# Apply lock + stamp updates + drafts (opens no PR locally)
npx tsx scripts/kb-sync.ts --apply

# Bootstrap / refresh lock hashes only (no KB edits)
npx tsx scripts/kb-sync.ts --lock-only
```

Exit codes: `0` = unchanged, `2` = changes written (CI opens PR), `1` = error.

### How to add a URL

1. Edit `sources.yaml` — add an entry with:
   - `id` — stable slug (e.g. `carpet-shipping`)
   - `url` — live page (single source of truth)
   - `kb_file` — target markdown file in this directory
   - `kb_section` — exact heading (e.g. `## Shipping policy`)
   - `tier` — `1` for policies/legal/CS facts polled weekdays
   - `extract` — `curated_bullets` (default) or `cite_only` (hash track only)
   - `preserve_notes` — optional list of `### …` headings the sync must never delete (bot handoff overrides)
2. Run `npx tsx scripts/kb-sync.ts --lock-only --id=<your-id>` to seed the lock entry.
3. Open a PR with the yaml + lock change.
4. Optionally trigger **KB sync** workflow manually (`workflow_dispatch`) to verify.

### preserve_notes

Operator-locked blocks (e.g. WhatsApp bot handoff overrides) live inside KB sections under their own `###` heading. If sync would remove a listed block, the job **fails** so routing notes are not dropped silently.
