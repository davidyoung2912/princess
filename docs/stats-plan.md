# Your stats

A page under Me (`/me/stats`, screen M46) that shows a guest their own numbers in sections, with made-up stats beside the real ones, and a way to share any of it.

## How it works

- **The server works everything out.** `GET /me/stats` (`StatsEndpoints`) reads the guest's data in a few queries (`DapperStatsStore`: one batch of about 100 scalar sub-selects, one batch of "favourite" lookups, the counters and the days table) and `StatsRules.Build` turns it into sections. The front end only draws and shares what it is given, so adding a stat is a server change only.
- **Real stats come from tables that already exist** (audit trail for sign-ins, chat, dining, orders, shows, excursions, spa, folio, bookings, past trips, checklist and so on). Only what the app itself sees needs new storage.
- **Two new tables** (`db/01-schema.sql`): `UserCounters` (key, value; screen views, seconds in the app, hour of day, shares) and `UserDays` (one row per day used: seconds, views, opens; drives streaks and busiest weekday).
- **Tracking** is `POST /me/stats/track`, fed by `src/stats/tracker.ts` (pure counting) and `src/hooks/useStatsTracker.ts` (mounted in the Shell: counts a screen view per route, counts 10 seconds while the page is visible and the guest touched it in the last minute, sends every minute and when the page is hidden). The server accepts only fixed key shapes (`opens`, `views`, `seconds`, `shares`, `hour.00`-`hour.23`, `area.<tab>`, `route.<screen>`), caps values, and caps a guest at 200 counters.
- **Made-up stats** are flagged `joke` in the report and shown with a dashed tile and a "Made up" label (text, not just colour). Their numbers come from a hash of the guest's id and a name, often scaled by a real stat, so they stay put between visits; the Forecast and fortune section also changes each day. The page has a switch that hides them from the page and from anything shared.
- **Sharing** is text only (`src/stats/share.ts`): one stat, one section, the highlights card, or everything, through the phone's share sheet or the clipboard. A made-up stat always carries "(made up)" in shared text.

## What is in it

Real sections: Life in the app, Sign-ins and security, Chat, Stanley, Eating and drinking, Shows and events, Ports and excursions, Spa and wellness, Money and spending, Your voyages, Getting ready, Around the ship, Friends and family, Records and badges (27 badges). Made-up sections: Buffet science, Seagull relations, What Stanley privately thinks, Cabin physics, Forecast and fortune, Towel animal intelligence. Every real section also ends with two or three made-up stats.

## Adding a stat

1. A real stat that is a count: add a scalar sub-select to `DapperStatsStore.Numbers` (name it in snake_case), then an `S(...)` line in the section in `StatsRules`.
2. A stat the app has to count itself: add a counter key to `StatsRules.KnownCounter` and count it with `createTracker`.
3. A made-up stat: add a `J(...)` line. Use `Roll`/`Pick` with a unique salt so the number is stable.

## Not done

- No server unit tests yet for `StatsRules` (the verification rules here are the npm checks only).
- Stats are for the signed-in person only (a view-as child token shows the child's). No comparison with other guests, by design.
