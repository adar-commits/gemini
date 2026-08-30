-- Switch production to hybrid routing (T0 + regex guessMasterRoute + LLM fallback).
-- Run once on Landbot Supabase after deploy.
update public.hom_agent_runtime_config
set routing_mode = 'hybrid',
    updated_at = now(),
    updated_by = 'migration:routing_hybrid'
where id = 'production'
  and routing_mode = 'llm';
