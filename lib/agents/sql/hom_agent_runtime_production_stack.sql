-- Production stack decided in the 2026-09-07 cost/quality audit (applied to Supabase):
--   * Main agent (faq role — the only role v3 uses for replies): Claude Sonnet 4.6.
--     Best Hebrew quality per cost among the models tried (Opus / GPT-5.5 / Sonnet).
--   * Router role (used only for conversation summaries in v3): Gemini Flash-Lite.
--   * Error fallback model is code-side (lib/hom-agent/invoke.ts → economy profile).
update public.hom_agent_runtime_config
set
  active_profile = 'custom',
  history_limit = 12,
  orchestra_mode = 'off',
  profile_json = '{
    "router": {"model": "google/gemini-2.5-flash-lite", "temperature": 0.1, "maxOutputTokens": 256},
    "faq": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.18, "maxOutputTokens": 800},
    "sales": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.25, "maxOutputTokens": 800},
    "service": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.15, "maxOutputTokens": 800}
  }'::jsonb,
  updated_at = now(),
  updated_by = 'audit-sonnet-single-call'
where id = 'production';
