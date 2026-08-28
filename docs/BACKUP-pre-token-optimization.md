# Backup — before Token Optimization Master Plan

**Created:** 2026-08-28  
**Git tag:** `backup/pre-token-optimization`  
**Commit at tag:** `9b0e201` (main)

## What this backup is

Snapshot of the HOM WhatsApp bot **before** token optimization work:

- Phase 1: `hom_agent_token_usage` table, history limit 18, per-call token logging
- Phase 2: confidence-based skip-master (`confident-route.ts`)
- Phase 3: multi-question combined into one reply

## Restore code to pre-optimization state

```bash
cd /Users/dr/gemini
git fetch origin
git checkout main
git reset --hard backup/pre-token-optimization
git push origin main --force-with-lease   # only if you want remote main reverted too
```

Safer alternative (no force push): checkout the tag in a throwaway branch and deploy that, or revert the optimization commits one-by-one.

```bash
git checkout -b restore-pre-token-optimization backup/pre-token-optimization
```

## Restore Supabase (if migrations were applied)

If Phase 1 SQL was applied to Landbot Supabase (`walklyxhkhrdzbkfhtez`):

```sql
-- Revert history limit (optional)
UPDATE public.hom_agent_runtime_config SET history_limit = 40 WHERE id = 'production';

-- Drop token table (optional — loses collected metrics)
DROP TABLE IF EXISTS public.hom_agent_token_usage;

-- Remove shadow log token columns (optional)
ALTER TABLE public.hom_agent_shadow_logs
  DROP COLUMN IF EXISTS input_tokens,
  DROP COLUMN IF EXISTS output_tokens,
  DROP COLUMN IF EXISTS routing_path;
```

## Plan reference

See `.cursor/plans/token_optimization_master_*.plan.md` for the full implementation plan.
