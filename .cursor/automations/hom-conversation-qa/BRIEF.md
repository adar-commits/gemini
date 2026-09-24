# QA automation brief

Plain-language log of auto-fix commits. Tell the agent: **vanish commit `sha`** to revert.

## Recent

- **a81c031** · chat [530876768](https://service.hom-group.co.il/conversations/530876768) · human_assign — After exchange was chosen and the order card was confirmed, the bot wrote a service summary and assigned service instead of the exchange-kind question and a sales handoff. _(files: conversation-hints.ts, exchange-order-confirm-530876768.test.ts)_ · vanish: `npm run qa:vanish a81c031eb93f2e557d18f6ac1586b3f08f407449`
