-- Plan K: lean on session summary; reduce re-sent transcript tokens
update public.hom_agent_runtime_config
set
  history_limit = 10,
  updated_at = now(),
  updated_by = 'token-optimization-plan-k'
where id = 'production';
