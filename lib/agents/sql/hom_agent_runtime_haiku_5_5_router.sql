-- Patch production router only → Claude Haiku 5.5 (summaries / router role).
-- Run on Landbot Supabase when profile_json.router still points at haiku-4.5.
update public.hom_agent_runtime_config
set
  profile_json = jsonb_set(
    coalesce(profile_json, '{}'::jsonb),
    '{router,model}',
    '"anthropic/claude-haiku-5.5"'::jsonb,
    true
  ),
  updated_at = now(),
  updated_by = 'haiku-5.5-router'
where id = 'production';
