# QA automation brief

Plain-language log of auto-fix commits. Tell the agent: **vanish commit `sha`** to revert.

## Recent

- **df9edd6** · chat [424358153](https://service.hom-group.co.il/conversations/424358153) · human_assign — Pre-turn treated כן תודה as handoff confirm but inferHumanHandoffAction scanned whole thread for sales intent from exchange menu and assigned sales. _(files: off-topic.ts, return-portal-service-handoff-424358153.test.ts)_ · vanish: `npm run qa:vanish df9edd6495fefbe5bde0a625e75a18e810567701`
- **a81c031** · chat [530876768](https://service.hom-group.co.il/conversations/530876768) · human_assign — After exchange was chosen and the order card was confirmed, the bot wrote a service summary and assigned service instead of the exchange-kind question and a sales handoff. _(files: conversation-hints.ts, exchange-order-confirm-530876768.test.ts)_ · vanish: `npm run qa:vanish a81c031eb93f2e557d18f6ac1586b3f08f407449`
