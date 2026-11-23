# Round 2 gaps: what the overnight pass (R1 to R8) could not fully close

Started 2026-11-23. Each phase adds its leftovers here. G-01 (pilot banner) was dropped by the owner: the app is a prototype and the UX sits on backend frameworks that mask real-world specifics. Verification for every phase: `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only (project rules); nothing was walked on a device.

## R1 Continuity

Built: scroll position remembered per history entry and restored on Back (`src/routes/scrollMemory.ts`, `Shell.tsx`); filters mirrored into the address on dining and activity explorers, excursions, ports, venues and the day planner (`useMirrorParams`); saving or un-saving with no signal is held and sent on reconnect (`src/data/favouriteQueue.ts`).

Open:
- Other list screens still keep filters in component state only: spa explorer, sailings compare, cabin chooser, reservations list, chat people. Scroll restore covers them, but chips reset.
- Notes (diary, packing, personal reminders) are not queued offline yet; only favourites are. Notes are already kept locally, so nothing is lost, but they do not reach the server until the screen is used online.
- Scroll restore waits up to about 40 frames for a lazy list to grow; a very slow list may open short of the old place. Needs a device check.
- "What is fresh" panel: `CapsuleCard` already lists age per kind; it is not linked from Me and does not cover booking, excursions or check-in as separate lines.
