-- Restore transcript window for longer threads (operator request)
update public.hom_agent_runtime_config
set
  history_limit = 18,
  updated_at = now(),
  updated_by = 'operator-history-18'
where id = 'production';
