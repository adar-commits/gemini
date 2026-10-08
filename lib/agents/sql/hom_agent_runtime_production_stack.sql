-- Production stack (2026-09-07 audit, upgraded same day to the Claude 5 family):
--   * Main agent (faq role — the only role v3 uses for replies): Claude Sonnet 5
--     ($2/$10 per MTok — better AND cheaper than Sonnet 4.6).
--   * Router role (conversation summaries in v3): Claude Haiku 5.5 ($0.10/$0.50).
--   * Trainer-correction parsing, shadow review: Haiku 5.5 (code-side defaults).
update public.hom_agent_runtime_config
set
  active_profile = 'custom',
  history_limit = 10,
  orchestra_mode = 'off',
  profile_json = '{
    "router": {"model": "anthropic/claude-haiku-5.5", "temperature": 0.1, "maxOutputTokens": 256},
    "faq": {"model": "anthropic/claude-sonnet-5", "temperature": 0.18, "maxOutputTokens": 1024},
    "sales": {"model": "anthropic/claude-sonnet-5", "temperature": 0.25, "maxOutputTokens": 800},
    "service": {"model": "anthropic/claude-sonnet-5", "temperature": 0.15, "maxOutputTokens": 800}
  }'::jsonb,
  updated_at = now(),
  updated_by = 'haiku-5.5-upgrade'
where id = 'production';
