-- Longer transcript window so the agent keeps earlier order / name / choice context in multi-step threads.
-- Revert: lib/agents/sql/hom_agent_runtime_history_18.sql
update public.hom_agent_runtime_config
set
  history_limit = 24,
  updated_at = now(),
  updated_by = 'agent-revolution-history-24'
where id = 'production';
