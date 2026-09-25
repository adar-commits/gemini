# QA automation brief

Plain-language log of auto-fix commits. Tell the agent: **vanish commit `sha`** to revert.

## Recent

- **6415e24** · chat [532711282](https://service.hom-group.co.il/conversations/532711282) · manual — למכירות לא היו ימי פעילות: הבוט חשב שהם פתוחים גם בשבת ובשישי באותן שעות. עכשיו מכירות א-ה 09:30-18:00, ו 09:00-14:00, שבת סגור; שירות סגור בשישי ושבת; בסוף שבוע נכתב 'הצוות חוזר ביום ראשון מ-...'. _(files: lib/agents/human-agent-hours.ts, lib/agents/__tests__/weekend-hours-532711282.test.ts, lib/agents/__tests__/human-agent-hours.test.ts, lib/hom-agent/__tests__/after-hours-help-first-532711282.test.ts)_ · vanish: `npm run qa:vanish 6415e240117b4ac7fddfb1eab0c0559fff45f7d9`
- **e49fc80** · chat [532360395](https://service.hom-group.co.il/conversations/532360395) · human_assign — After order cards were rejected, phone recheck broke binding when customer confirmed the last card with a side size question — bot sent never-stuck instead of delivery status. _(files: hom-bot.md, conversation-hints.ts, phone-recheck-order-confirm-532360395.test.ts)_ · vanish: `npm run qa:vanish e49fc8000fcb67805426f2b2c2de10d9b37dbbdc`
- **df9edd6** · chat [424358153](https://service.hom-group.co.il/conversations/424358153) · human_assign — Pre-turn treated כן תודה as handoff confirm but inferHumanHandoffAction scanned whole thread for sales intent from exchange menu and assigned sales. _(files: off-topic.ts, return-portal-service-handoff-424358153.test.ts)_ · vanish: `npm run qa:vanish df9edd6495fefbe5bde0a625e75a18e810567701`
- **a81c031** · chat [530876768](https://service.hom-group.co.il/conversations/530876768) · human_assign — After exchange was chosen and the order card was confirmed, the bot wrote a service summary and assigned service instead of the exchange-kind question and a sales handoff. _(files: conversation-hints.ts, exchange-order-confirm-530876768.test.ts)_ · vanish: `npm run qa:vanish a81c031eb93f2e557d18f6ac1586b3f08f407449`
