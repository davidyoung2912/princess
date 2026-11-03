# Stage-tailored menus: matrix

The data is `STAGE_MENUS` in `src/routes/stageMenus.ts`; this is the same matrix for review. The stage comes from `useJourneyPosition()`
(booking + the testing date). **Nothing is hidden**: a stage's hubs come first and open, the remaining hubs stay below, closed, and every
screen stays reachable by search. "Most used" gets up to three stage screens on top of the usual list. The tab bar keeps its fixed order.

| Stage | Home leads | Plan leads | Ship leads | Me leads | Added to Most used |
|---|---|---|---|---|---|
| dream | discover | wish, group | find | rules | quiz, cruise, saved; ship info |
| discover | discover, ask | money, wish | find | | cruise cost, decide, cabins; price watch |
| book | discover | money, group | | money, docs | offers, cabins; money plan, contract; payments |
| manage | ask | docs, pack, group | | money, docs | summary; readiness, medical; payments, documents |
| prebook | ask | pack, wish, week | find | money | summary; ahead, ship packing; ship info |
| getToShip | board, change | travel, pack | | docs | disruption, delayed; getting there, weather; documents |
| embark | board | week | safety, find | | find pass, meeting point, luggage; muster; day |
| sea | ask | week | find, service, people | money | briefing; where, spa; ledger |
| port | ask | week | port, safety | | excursions; port guide, safe ashore, port snapshot |
| disembark | leave | | service | money | bags, onward, final night; final bill |
| remember | discover | wish | | after | sailings; recap, memories, rebook |
