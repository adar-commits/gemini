# Trainer T3 — Model Architect

## Selected stack (owner-confirmed)

| Role | Model | Temp | Rationale |
|------|-------|------|-----------|
| Router | `anthropic/claude-sonnet-4.6` | **0.1** | Smarter Hebrew routing fallback than Flash |
| FAQ | `anthropic/claude-opus-4.6` | **0** | Best policy grounding |
| Sales | `anthropic/claude-opus-4.6` | **0.25** | Natural intake when LLM runs |
| Service | `anthropic/claude-opus-4.6` | **0.15** | Case intake + handoff judgment |

## Why Orchestra was removed

- 4 extra LLM calls per turn (phase, intent, risk, strategy advisors)
- Injected conflicting guidance (dissatisfaction → service vs FAQ-first)
- Added latency without improving shadow-review accuracy
- Deterministic rules + single router + specialist is sufficient

## Why not one model for everything

- FAQ at temp 0 needs strong instruction-following → Claude Sonnet
- Router at temp 0.1 on Flash keeps cost down for high volume WhatsApp
- Sales at 0.3 on same Sonnet avoids second model while allowing natural Hebrew

## Future A/B (not v1)

- Router: `gemini-2.5-flash` vs `flash-lite` on shadow set
- FAQ: temp 0 vs 0.1 on hallucination rate
- Service: 0.2 vs 0 on premature human_service rate
