# Testing date: audit of what reads the clock (phase 2)

Checked every use of the real clock on the front end (`Date.now()`, `new Date()`) and the server (`DateTime.UtcNow`, `IClock`, `IUserClock`).

## Already follows the testing date

- All server services that act for a signed-in user read `IUserClock` (trips, bookings, check-in, plan, post-cruise, chat, media, push,
  reminders, privacy, share links, concierge, state). Menus, entertainment, ship position and navigation feeds are keyed by the sailing and
  the moment the screen sends, which comes from `demoNow()`.
- 184 front-end uses of `demoNow()` / `useNow()` / `useDemo()` for day, stage and time.

## Leaks found

| Where | Real clock used for | Decision |
| --- | --- | --- |
| `ShareScreens.tsx` link state | whether a share link is live or expired | **Fixed**: uses `useNow()` |
| `DiscoverService.DatesAsync` (`/sailings/bookable`) | days to departure, bookable | Left: anonymous endpoint with no user, and no screen calls it |
| `AutopilotService.TrialDayAsync` | which sailing a visitor sees | Left: anonymous, signed-out visitor |
| `PortRowService` | clamping row timestamps | Left: paired with the device's own `Date.now()` stamps (`PortDelights`) |
| `RateService`, `OpenMeteoWeather`, `ProviderGuard`, `CalendarFeedService` public feed, token/auth | live rates, provider health, public calendar token expiry, sign-in | Left: genuinely real-time concerns |
| Cache and outbox (`feed.ts`, `useOutbox`, `useRates`, `runtime`) | staleness and retry timing of device copies | Left: device housekeeping, not journey time |
| `SignInFlows` | date-of-birth upper bound | Left: a real calendar limit |

## Countdowns added

`src/domain/countdowns.ts` (pure, tested) gives days to boarding, days left to pay the balance and days until online check-in opens, all from
the app's "now". Home shows them above the next step while they are ahead.
