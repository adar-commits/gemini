-- 2026-09-25: Opus 5.5 as the default reply model (was Sonnet 5 + Opus only on hard cases),
-- warmer temperature so replies stop sounding templated, a bit more output room.
-- Revert: set faq.model back to anthropic/claude-sonnet-5, temperature 0.18, maxOutputTokens 800.
update public.hom_agent_runtime_config
set profile_json = jsonb_set(
      jsonb_set(
        jsonb_set(profile_json, '{faq,model}', '"anthropic/claude-opus-5.5"'),
        '{faq,temperature}', '0.35'
      ),
      '{faq,maxOutputTokens}', '1000'
    ),
    updated_at = now(),
    updated_by = 'agent-revolution-2026-09-25'
where id = 'production';
