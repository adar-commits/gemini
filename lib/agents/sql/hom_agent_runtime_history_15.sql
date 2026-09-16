-- Restore conversation history window after cost cut (10 → 15).
-- Code defaults also use 15; apply to production runtime row.

update public.hom_agent_runtime_config
set
  history_limit = 15,
  updated_by = 'history_15_restore_2026-09-16'
where id = 'production';
