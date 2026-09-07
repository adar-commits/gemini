-- Production stack (2026-09-07 audit, upgraded same day to the Claude 5 family):
--   * Main agent (faq role — the only role v3 uses for replies): Claude Sonnet 5
--     ($2/$10 per MTok — better AND cheaper than Sonnet 4.6).
--   * Router role (conversation summaries in v3): Claude Haiku 4.5 ($1/$5).
--   * Error fallback, trainer-correction parsing, shadow review: Haiku 4.5 (code-side).
update public.hom_agent_runtime_config
set
  active_profile = 'custom',
  history_limit = 16,
  orchestra_mode = 'off',
  profile_json = '{
    "router": {"model": "anthropic/claude-haiku-4.5", "temperature": 0.1, "maxOutputTokens": 256},
    "faq": {"model": "anthropic/claude-sonnet-5", "temperature": 0.18, "maxOutputTokens": 800},
    "sales": {"model": "anthropic/claude-sonnet-5", "temperature": 0.25, "maxOutputTokens": 800},
    "service": {"model": "anthropic/claude-sonnet-5", "temperature": 0.15, "maxOutputTokens": 800}
  }'::jsonb,
  updated_at = now(),
  updated_by = 'audit-sonnet5-haiku45'
where id = 'production';
