-- Production: quality profile on OpenAI GPT-5.5 (Sonnet-tier), 12-message memory window.
update public.hom_agent_runtime_config
set
  active_profile = 'quality',
  history_limit = 12,
  profile_json = '{
    "router": {"model": "openai/gpt-5.5", "temperature": 0.1, "maxOutputTokens": 96},
    "faq": {"model": "openai/gpt-5.5", "temperature": 0.18, "maxOutputTokens": 800},
    "sales": {"model": "openai/gpt-5.5", "temperature": 0.25, "maxOutputTokens": 800},
    "service": {"model": "openai/gpt-5.5", "temperature": 0.15, "maxOutputTokens": 800}
  }'::jsonb,
  updated_at = now(),
  updated_by = 'openai-quality-gpt55'
where id = 'production';
