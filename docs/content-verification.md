# Content verification list (N8.3)

Every authored line that says "(verify)" or tells the guest to check it. Nothing here has a recorded source yet. For each line, write the source and date in the **Source** column and set **Status** to `checked`, or remove the line. The owner signs off at the bottom. Legal, safety, health, document and port-rule text must not ship to a real pilot unchecked.

## Port guides added in X0g (2026-11-03)

Authored in `server/Princess.Api/Domain/PortsReference.cs` as concept samples, with no recorded source yet: guides and knowledge for 21 Tier A ports (Celebration Key, Grand Turk, San Juan, Amber Cove, Southampton, Barcelona, Palma, Marseille, Genoa, La Spezia, Civitavecchia, Naples, Athens, Santorini, Mykonos, Kusadasi, Copenhagen, Tokyo/Yokohama, Hakodate, Singapore, Sydney). Fort Lauderdale keeps its guide only. Everything in them (taxi fares in US dollars, day pass prices, excursion prices, hours, local laws, tipping norms in `src/domain/delights.ts`, phrases and allergy cards) is **unverified**: each law line says "(verify)", and the allergy cards and phrases need a native-speaker check before real use. Line numbers in the table below are from before X0g and are out of date; regenerate with the grep above.

Per-country entry rows (passport months and visa hint for 36 countries, in `ReferenceRules.cs`) are authored from general knowledge and are unverified: check each against the country's official source before relying on it. Not authored: Tier B short guides, ashore contacts and the port day pilot for the new ports.

Regenerate the list with: `grep -rn "(verify)" src server/Princess.Api --include=*.ts --include=*.cs`

| File:line | Text | Source | Status |
| --- | --- | --- | --- |
| src/i18n/locales/en.ts:5062 | 'journey.early.verify': 'These amounts are guides, and the cruise line’s position on a missed sailing should be checked (verify).', | | open |
| src/i18n/locales/en.ts:5085 | 'journey.verify': 'Check times, prices and pick-up points before you travel (verify).', | | open |
| src/domain/journey.ts:123 | /** Authored guides, "(verify)" wherever shown. */ | | open |
| server/Princess.Api/Domain/PortsReference.cs:230 | "Taking coral, shells and sea life from the reef is illegal and fined (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:231 | "Vaping devices are restricted in Mexico; leave them aboard (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:232 | "Carry ID or a copy, not the original passport (verify)" | | open |
| server/Princess.Api/Domain/PortsReference.cs:365 | "Reef and wildlife protection is strict; do not take coral, shells or animals (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:366 | "Check local rules on what you may wear, carry or fly (such as drones) before you go ashore (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:367 | "Drug possession is illegal and enforced (verify)" | | open |
| server/Princess.Api/Domain/PortsReference.cs:504 | "Taking coral, shells and sea life is illegal (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:505 | "Reef-protecting sunscreen is requested in marine parks (verify)", | | open |
| server/Princess.Api/Domain/PortsReference.cs:506 | "Drug possession is illegal and enforced (verify)" | | open |

Sign-off: ______________________  Date: __________
