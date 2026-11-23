# Princess Cruises PWA — Free MCP Services for Stanley

## Research, demonstration opportunities and recommended integration strategy

**Prepared:** 23 November 2026  
**Purpose:** Identify publicly accessible or open-source Model Context Protocol (MCP) services that can provide real travel and cruising information to Stanley in a demonstrable Princess PWA, while establishing an architecture that can later connect to authorized Mobi/Princess MCP services.

---

# 1. The concept: Stanley's External Intelligence Network

This is worth pursuing as a specific feature of the PWA. Rather than connecting one or two public MCP servers as a technical experiment, build **Stanley's External Intelligence Network**: a curated collection of independently operated MCP services that allows Stanley to access real cruise, destination, transportation, weather and travel information.

The important commercial message is:

> Your PWA already knows how to connect an AI passenger companion to external travel services using an open integration standard. Princess/Mobi becomes another provider in that ecosystem, rather than requiring a completely new integration architecture.

There are three categories of MCP services to demonstrate:

1. **Cruise intelligence:** Search cruise lines, ships, voyages, itineraries, cabins, prices and cruise-related information.
2. **Destination intelligence:** Search ports, attractions, local businesses, transport, walking routes, weather and visitor information.
3. **Travel logistics:** Flights, transfers, accommodation, currency conversions and other information useful before and after the cruise.

The first category demonstrates cruise-domain knowledge. The second demonstrates Stanley's ability to help passengers enjoy destinations. The third supports the broader 11-stage passenger journey.

The purpose is not simply to show that Stanley can retrieve information and print it in a chat window. The more valuable demonstration is how he combines information from several independent sources to accomplish something useful for a passenger.

# 2. MCP services to investigate

The following shortlist reflects publicly documented services and repositories reviewed as of 23 November 2026. Public availability, authentication requirements, data coverage and licensing can change; recheck the provider documentation before implementation or commercial use.

## A. Cruise-specific services

### 2.1 Siloah Travel MCP

**Provider:** Siloah Travel  
**Documentation / repository:** https://github.com/siloah-travel/siloah-travel-mcp  
**Remote MCP endpoint:** `https://mcp.siloah.travel/mcp`  
**Authentication:** No API key advertised in the public documentation.  
**Transport:** Streamable HTTP.

Advertised catalogue coverage:

| Category | Advertised records |
|---|---:|
| Voyages | 70,000+ |
| Ships | 678 |
| Cruise lines | 62 |
| Ports | 6,700+ |
| Cabin types | 11,000+ |

Documented tools include:

| Tool | Purpose |
|---|---|
| `searchVoyages` | Find sailings by destination, dates, cruise line and price |
| `searchBrands` | Identify cruise lines |
| `searchShips` | Retrieve ship information |
| `searchByContent` | Research ship restaurants, facilities, cabins and ports |

The project also documents REST equivalents of its MCP tools.

**Potential Stanley use:**

A passenger might ask: “Stanley, find us a seven-day Mediterranean cruise in September. We like smaller ships and interesting historical ports.” Stanley can search the external service, compare results against passenger preferences and generate interactive sailing cards.

This is a useful way to demonstrate genuine external cruise-data retrieval rather than relying entirely on local sample data.

**Qualifications:**

- The server code has an MIT licence, but this does not automatically license all aggregated third-party cruise data.
- The README says data comes from multiple providers and is updated regularly, but that is not an independently verified freshness guarantee.
- Test whether Princess sailings are actually covered before claiming they are.
- Validate the source, freshness and permitted commercial use of each data category.

**Assessment:** Test Siloah first for broad cruise discovery, subject to verifying Princess coverage and obtaining clarity about data rights.

### 2.2 CruiseHops

**Provider:** CruiseHops  
**Official integration documentation:** https://cruisehops.com/integrations  
**Remote MCP endpoint:** `https://cruisehops.com/mcp`  
**Authentication:** None advertised.  
**Transport:** Streamable HTTP.  
**Access:** Read-only cruise research.

CruiseHops documents cruise searches and comparisons for Carnival and Royal Caribbean. It also provides captured fare observations and exact-offer price history. Its published terms distinguish observed prices from live quotes and guaranteed availability.

**Potential Stanley use:**

“Stanley, compare a few Caribbean cruise options across different cruise lines.”

This is a useful secondary demonstration of the integration layer supporting multiple cruise-data providers.

**Limitations:**

- The documented cruise coverage is Carnival and Royal Caribbean, not Princess.
- Historical or observed prices must not be presented as live cabin inventory or confirmed booking prices.
- Confirm commercial usage terms before incorporating it into a commercial product.

**Assessment:** Use as an alternative cruise-search demonstration provider, not as a source of authoritative Princess information.

## B. Destination and excursion intelligence

### 2.3 GoVisit — destination and port intelligence

**Provider:** GoVisit  
**MCP documentation:** https://govisit.ai/en/docs/developers/mcp/overview  
**Remote MCP endpoint:** `https://govisit.ai/mcp`  
**Authentication:** No GoVisit API key required for public reads.  
**Transport:** Streamable HTTP.  
**Published capabilities:** 22 documented public read skills.

Documented capabilities include:

- `search_destinations`
- `search_places`
- `get_destination_overview`
- `get_destination_activities`
- `get_destination_highlights`
- `get_destination_categories`
- `get_place_overview`
- `get_place_visit_facts`
- `get_related_places`
- `get_statistics`

These support destination and place discovery, activity information and visitor facts.

**Potential Stanley use:**

“Stanley, we're stopping in Kotor tomorrow. What are the three most interesting things we could do without travelling too far?”

Stanley can use GoVisit to discover attractions and visitor information, then combine the results with the passenger's port timetable and preferences.

This is a strong fit for the port-guide objectives:

- How do I get ashore?
- What can I do?
- How much time do I have?
- When must I be back?

**Licensing considerations:**

GoVisit's November 8, 2026 Data Use License reportedly permits commercial travel-planning and itinerary applications to answer individual traveller requests and create private itineraries using concise GoVisit excerpts, with attribution. It prohibits bulk extraction, resale, redistribution as a dataset and competing data products. Apps monetizing travel referrals, and OTAs or travel marketplaces, may need a separate agreement.

Before commercial use, check the current license against the exact PWA business model, particularly if excursion referrals, booking links or monetized recommendations are involved.

Also test how much of its catalogue covers the actual ports in a representative Princess itinerary. Public access does not guarantee comprehensive worldwide cruise-port coverage.

**Assessment:** First choice for a destination-intelligence demonstration, subject to coverage and licensing review.

### 2.4 GetExperience MCP

**Provider / repository:** https://github.com/SKurakov/getexperience-mcp  
**Endpoint:** `https://getexperience.com/mcp`

The published project offers public catalogue browsing without an API key. Its capabilities include searching tours and activities, viewing details, checking schedules and prices. Actual B2B booking requires a separate partner arrangement and credentials.

**Potential Stanley use:**

- Search for guided experiences near a cruise port.
- Compare tour categories and published details.
- Present booking links where supported.
- Combine activity data with the passenger's port schedule.

**Limitations:**

- Keep the initial integration read-only.
- Do not imply Stanley can make reservations through the public endpoint.
- Validate coverage, price freshness, data source and commercial terms.
- This is an early-stage community project; test its reliability before a buyer-facing demonstration.

**Assessment:** Interesting alternative for excursion and activity discovery.

### 2.5 Peek Experiences

**Provider:** Peek  
**MCP listing:** https://mcphub.travel/servers/peek

The MCP listing describes access to more than 300,000 activities, with prices and availability retrieved at search time. The published description says it is read-only and returns booking links rather than creating reservations. It reports a public, no-account access model through an early-access connection on MCPHub.travel.

**Assessment:** Worth testing, but do not make it a foundational dependency until the direct endpoint, availability semantics and commercial permissions are confirmed.

## C. Maps and local routing

### 2.6 OpenStreetMap MCP (`osm-mcp`)

**Repository:** https://github.com/ni-c/osm-mcp  
**Deployment:** Self-hosted open-source MCP server.

The implementation provides 11 read-only tools for:

- Geocoding.
- Finding nearby points of interest.
- Retrieving place information.
- Walking, driving and cycling routes.
- Route optimization.
- Distance calculations.
- Isochrones and travel-area analysis.

It uses public services including Nominatim, Photon, OSRM, Valhalla and Overpass.

The documented implementation is primarily a local STDIO MCP server, rather than an anonymous hosted endpoint that can simply be added to a remote MCP configuration. The project describes an MCP Hub approach for exposing local servers to remote clients with authentication. Alternatively, deploy the server within controlled infrastructure and expose it through Streamable HTTP.

**Potential Stanley use:**

“Stanley, find three interesting places near the cruise terminal in Kotor. Show me which ones I could comfortably walk to, and suggest the best order to visit them.”

This is more compelling than simply listing attractions. Stanley can present a map, route, distance and sequence of stops.

**Important qualifications:**

- The MIT licence applies to the published server code, not necessarily all underlying data or hosted services.
- Public mapping services impose fair-use and attribution requirements.
- Nominatim's public service specifies a maximum of one request per second and requires an identifying User-Agent.
- Mapped accessibility data can be incomplete, particularly for entrances, steps, gradients and operational status.
- Do not interpret missing accessibility data as evidence that a venue is accessible.

**Assessment:** Strong candidate for a polished port-planning demonstration. Self-host it and respect the underlying services' policies.

## D. Weather and marine information

### 2.7 Open-Meteo MCP

**MCP server repository:** https://github.com/cyanheads/open-meteo-mcp-server  
**Example hosted endpoint documented by the project:** `https://open-meteo.caseyjhand.com/mcp`

The server advertises 12 tools supporting:

- Geocoding.
- Current and forecast weather.
- Historical weather.
- Marine conditions.
- Air quality.
- Climate projections.
- Terrain elevation.

It also provides a local deployment option.

**Potential Stanley use:**

- Port-day weather recommendations.
- Outdoor excursion suitability.
- Marine conditions.
- What to bring ashore.
- Whether to consider alternative activities.

**Commercial licensing warning:**

Open-Meteo's free API terms restrict the free tier to non-commercial use. Commercial products need an appropriate paid subscription or another compliant data arrangement. Data attribution requirements also apply. A public MCP endpoint does not remove the underlying API licensing requirements.

Use it for non-commercial technical testing only unless the appropriate commercial licence or permission is obtained. Confirm the current terms before implementation.

An older IBM MCP implementation was archived on September 26, 2026; avoid building on that archived project when a current implementation is available.

## E. Pre-cruise and post-cruise logistics

### 2.8 OctoTrip Flights

**Repository:** https://github.com/OctoTrip/flights  
**Remote MCP endpoint:** `https://mcp.octotrip.app/flights/mcp`

No account or API key is advertised. The `search` tool returns flight options and prices from multiple airlines and booking platforms, with links to book through the relevant provider. It does not book or modify flights itself. The service discloses affiliate attribution in its booking links.

**Potential Stanley use:**

- Stage 4: Manage pre-cruise travel.
- Stage 6: Get to the ship.
- Stage 10: Get home after disembarkation.

This extends cruise planning into the wider holiday.

**Qualifications:**

- Verify its commercial terms before embedding it in a Princess-facing commercial product.
- Disclose affiliate relationships when showing or using booking links.
- Distinguish live search results from confirmed bookings.
- Do not imply that Stanley can book or change flights through the read-only search tool.

### 2.9 Currency Converter MCP

**Endpoint:** `https://currency-mcp.wesbos.com`  
**Listing / documentation:** https://mcphub.travel/servers/currency-converter

The community listing describes current and historical exchange-rate lookups without an account or API key.

**Potential Stanley use:**

- Explain local currency in port.
- Convert an illustrative excursion or meal price into the passenger's preferred currency.
- Help passengers compare approximate costs across countries.

**Limitation:** These are reference rates, not guaranteed bank, cash-exchange or card conversion rates. Stanley should label the rate source, date and indicative nature of the calculation.

# 3. Recommended MCP shortlist

The following priority reflects the proposed PWA demonstration, not a claim that every provider is production-grade or commercially cleared.

| Priority | Service | Primary purpose | Deployment |
|---:|---|---|---|
| 1 | GoVisit | Port and destination discovery | Hosted |
| 2 | Siloah Travel | Cruise discovery | Hosted |
| 3 | OpenStreetMap | Walking routes and local geography | Self-host |
| 4 | OctoTrip Flights | Pre/post-cruise flights | Hosted |
| 5 | Open-Meteo | Weather and marine conditions | Hosted or self-hosted, with commercial licence for commercial use |
| 6 | GetExperience or Peek | Excursion and activity discovery | Hosted, subject to terms |
| 7 | CruiseHops | Competitor cruise comparisons | Hosted |

Do not connect every service at once. A smaller, curated set of tested tools makes Stanley more reliable, reduces unnecessary tool calls and keeps the demonstration understandable.

# 4. How Stanley should use these services

The real opportunity is for Stanley to orchestrate multiple MCP sources to solve passenger problems.

## Example: intelligent port-day planning in Kotor

Passenger asks:

> “We're visiting Kotor tomorrow. We have four hours and want to see something interesting, have lunch, and avoid too much walking.”

Behind the scenes:

1. **Your PWA** supplies the voyage, available time, port details and passenger preferences.
2. **GoVisit MCP** retrieves destination highlights and nearby attractions.
3. **OpenStreetMap MCP** finds suitable routes and calculates distances.
4. **Your PWA data** supplies saved dining preferences and any approved local information.
5. **Stanley AI** combines the results into a personalized itinerary.

The passenger sees a visually presented itinerary with a map, estimated walking times, recommended stops, lunch suggestions and a clear return-to-ship reminder.

The ship's actual arrival and all-aboard times must come from verified voyage data, not a third-party destination provider.

# 5. Recommended architecture

Build a provider-independent MCP gateway in the PWA backend.

```text
Stanley AI
  |
  v
MCP Integration Gateway
  - Tool selection
  - Permissions
  - Provider configuration
  - Response normalization
  - Logging and monitoring
  - Timeouts and retry policy
  |
  +-- Cruise adapter ------ Siloah / CruiseHops / future Mobi
  +-- Destination adapter - GoVisit / GetExperience / Peek
  +-- Routing adapter ----- OpenStreetMap
  +-- Weather adapter ----- Open-Meteo
  +-- Travel adapter ------ OctoTrip Flights
  +-- Currency adapter ---- Currency MCP
```

## 5.1 Canonical application-level operations

The rest of the PWA should consume stable application-level operations rather than provider-specific tool names.

```text
SearchCruises()
GetCruiseDetails()
GetShipInformation()
GetItinerary()
GetDestinationInformation()
SearchAttractions()
CalculateWalkingRoute()
GetWeatherForecast()
SearchFlights()
ConvertCurrency()
```

The MCP adapter maps each canonical operation to the provider's actual tools and schemas.

For example:

```text
Today:
SearchCruises() -> Siloah MCP

After Princess authorization:
SearchCruises() -> Mobi / Princess MCP
```

The application should not need to know which supplier fulfilled the request.

## 5.2 Example provider configuration

This is illustrative configuration, not an existing Mobi connection:

```json
{
  "McpProviders": {
    "CruiseDiscovery": {
      "Provider": "Siloah",
      "Endpoint": "https://mcp.siloah.travel/mcp",
      "Enabled": true
    },
    "DestinationDiscovery": {
      "Provider": "GoVisit",
      "Endpoint": "https://govisit.ai/mcp",
      "Enabled": true
    },
    "PrincessCruiseServices": {
      "Provider": "Mobi",
      "Endpoint": null,
      "Enabled": false
    }
  }
}
```

When Princess grants access, introduce the Mobi endpoint, credentials, scopes and tool mappings, then change the provider implementation for the relevant service.

Some adapter code will still be required because Mobi's tools and data schemas may differ. MCP standardizes communication; it does not guarantee equivalent business functionality or schema compatibility.

# 6. Passenger-facing demonstration scenarios

## Demonstration A — Cruise discovery (Stages 1–3: Dream, Discover, Book)

Passenger:

> “Stanley, we're interested in a Mediterranean cruise next summer, ideally around seven days. We like history, good food and interesting ports.”

Stanley interprets the preferences, calls the cruise-discovery MCP, normalizes results and presents interactive sailing cards with comparisons and clear data provenance.

Demonstrates:

- Conversational search.
- External MCP tool invocation.
- Multiple result cards.
- Comparisons and filtering.
- Stanley's contextual explanations.

External provider results must be labelled as third-party data, not official Princess fares or inventory.

## Demonstration B — Intelligent port-day planning (Stages 5 and 9: Prebook and Port)

Passenger:

> “Stanley, we're visiting Kotor. We have about four hours ashore. We'd like to see some interesting places, have lunch and not spend the whole time walking.”

Stanley combines GoVisit attraction information, OpenStreetMap routing and passenger preferences with the verified voyage schedule held in the PWA.

The interface displays a map, timeline, distances, suggested stops and return-to-ship information.

This supports the core port-guide questions:

- How do I get ashore?
- What can I do?
- How much time do I have?
- When must I be back?

## Demonstration C — Contextual weather planning (Stage 9: Port)

Passenger:

> “Stanley, should we change our outdoor plans tomorrow?”

Stanley retrieves the forecast and interprets it in the context of the saved port itinerary. The PWA displays weather conditions, expected temperature, rain probability, wind information, suggested changes and indoor alternatives.

## Demonstration D — Intelligent daily voyage planning (Stage 8: Sea)

Passenger:

> “Stanley, plan tomorrow for us. We want a relaxing day, lunch somewhere nice, a theatre show and some live music.”

Stanley combines passenger preferences, existing reservations, entertainment schedules, venue locations, available time and the ship's actual operating schedule where available.

This may use the PWA's own sample data rather than an external MCP source. Not every capability should be outsourced to a third-party MCP provider. The PWA should remain authoritative for its own passenger, voyage and itinerary data.

# 7. Mapping MCP to the 11-stage journey

| Journey stage | Useful external MCP capabilities | Importance |
|---|---|---|
| 1. Dream | Destination discovery, weather, cruise discovery | Medium |
| 2. Discover | Cruise inventory, ship and destination comparisons | High |
| 3. Book | Pricing and availability from authorized commercial services | Very high |
| 4. Manage | Travel requirements, destination facts, time-zone information | Medium |
| 5. Prebook | Excursion discovery, attractions, routing, weather | High |
| 6. Get to the ship | Airport/ground transport, maps, weather | High |
| 7. Embark | Ship and port information, maps | Medium |
| 8. Sea | Information retrieval, external experiences, contextual services | Medium |
| 9. Port | Attractions, walking routes, weather, local transport | Very high |
| 10. Disembark | Airport, transport and onward travel | High |
| 11. Remember | Photo and diary enrichment, destination information | Medium |

Prioritize MCP capabilities by passenger value, not simply by technical novelty. The opportunity is that the PWA can access a growing ecosystem of services through one consistent integration approach.

# 8. What to request from Mobi

A later technical conversation with Mobi should cover:

| Question | Why it matters |
|---|---|
| Is there a documented Princess MCP endpoint available for authorized third-party applications? | Establishes whether direct access is possible |
| Can Mobi provide a sandbox endpoint? | Allows safe demonstration |
| What transport is supported? | Establishes client compatibility |
| What authentication is required? | Establishes OAuth/API credential requirements |
| What tools are exposed? | Identifies actual Princess capabilities |
| Are pricing and availability tools exposed? | Distinguishes discovery from live commercial functions |
| Can authenticated passenger booking information be accessed? | Enables more advanced voyage assistance |
| Are transactional tools supported? | Determines whether Stanley can do more than provide information |
| Are there rate limits and usage charges? | Supports commercial planning |
| Can multiple AI providers use the same MCP services? | Supports OpenAI/Claude flexibility |
| Are there restrictions on embedding these services in a separately developed PWA? | Establishes contractual permission |

The central question is whether Mobi's services support direct server-to-server connections from a separately developed customer-facing application, rather than only LLM-hosted applications such as ChatGPT and Claude.

## 8.1 Suggested email to Mobi

**Subject:** Exploring MCP integration with the Princess Digital Guest Experience Platform

Hello Mobi team,

I have been following Mobi's work with Princess Cruises and the introduction of its conversational cruise-planning experience within ChatGPT and Claude.

I am developing a comprehensive Princess digital passenger experience platform, delivered as a responsive PWA, with an AI-powered guest companion called Stanley at its centre.

Stanley is designed to support passengers throughout the entire 11-stage customer journey, from initial cruise discovery and booking through pre-cruise preparation, onboard experiences, destination planning, disembarkation and post-cruise engagement.

We are particularly interested in the opportunity to integrate Stanley with Mobi's MCP infrastructure.

Our objective is to use the MCP standard to connect the PWA to authorized Princess services, including cruise discovery, itineraries, pricing, availability, excursions and, potentially, authenticated passenger and voyage information.

I would be interested in understanding whether Mobi supports direct server-to-server MCP connections for separately developed customer-facing applications, and whether a developer or partner sandbox is available.

We already have a functioning PWA prototype and an existing AI integration, so our interest is in demonstrating how the MCP layer could connect the existing passenger experience to Princess's services.

I would welcome an opportunity to discuss the available integration model and potential technical collaboration.

Regards

# 9. Security, data quality and commercial safeguards

## 9.1 Do not expose passenger information to public MCP services

Do not send a passenger's name, booking reference, cabin number, email address, loyalty details or other identifiable trip data to demonstration MCP services.

For external port searches, services generally need only:

- Destination.
- Approximate date.
- General interests.
- Accessibility requirements where necessary and consented.

Use synthetic passenger information during demonstrations.

## 9.2 Identify the provenance of every response

Stanley should distinguish between:

| Label | Meaning |
|---|---|
| Official Princess data | Confirmed from an authorized Princess source |
| External MCP data | Retrieved from an independent third-party provider |
| Estimated information | Calculated or inferred, not directly confirmed |
| Cached information | Previously retrieved and potentially out of date |

Each result should carry a provider identifier, retrieval timestamp and freshness status where available.

This is especially important for pricing, operating hours, excursions, local transport and weather.

## 9.3 Keep demonstration MCP tools read-only

Do not allow public MCP servers to create bookings, change reservations, make payments or execute consequential passenger actions.

All initial demonstrations should be read-only. If Mobi subsequently provides authorized transactional services, those should have explicit passenger confirmation and server-side permission checks.

## 9.4 Treat external MCP output as untrusted input

An MCP server is an external input into Stanley's reasoning process. Its results may contain misleading content or prompt-injection attempts.

Implement:

- An explicit tool allowlist.
- Input and output validation.
- Timeouts and rate limits.
- No unrestricted execution of tool-returned instructions.
- No sharing of private voyage context with unrelated services.
- Audit logs for tool invocation and results.
- Clear human confirmation for consequential actions.

## 9.5 Review commercial terms

Public MCP access does not automatically grant permission to incorporate a service or dataset into a commercial Princess product.

Review:

- Service terms.
- Data licensing.
- Attribution.
- Rate limits.
- Commercial usage rights.
- Redistribution rights.
- Availability guarantees.
- Subprocessor and privacy terms.

This is particularly important for Open-Meteo and third-party cruise datasets.

# 10. Implementation recommendations

## 10.1 Recommended sequence

1. **Connect GoVisit MCP.** Establish a functioning external MCP connection and have Stanley retrieve real destination and attraction information. Demonstrate port planning.
2. **Connect one cruise discovery MCP.** Evaluate Siloah first, then CruiseHops as an alternative. Demonstrate searches and comparisons with third-party data clearly labelled.
3. **Connect route intelligence.** Deploy osm-mcp in controlled infrastructure and let Stanley calculate walking distances and build a destination itinerary.
4. **Build the provider abstraction.** Put endpoint details and tool mappings into the integration gateway. Establish consistent application-level request and response contracts.
5. **Demonstrate provider replacement.** Switch the cruise discovery provider behind the canonical interface. Show that Stanley's experience does not change when the underlying provider changes.
6. **Prepare the Mobi integration adapter.** Document expected Mobi tool mappings and authentication requirements, ready for an authorized sandbox connection.

## 10.2 Operational design choices

- Implement MCP clients in the PWA backend, not directly in browser JavaScript.
- Keep credentials and provider secrets server-side.
- Use maintained MCP SDKs and the current Streamable HTTP transport where appropriate.
- Enforce per-provider timeouts, retry limits and circuit breakers.
- Cache low-volatility information where provider terms allow it; do not cache live availability as if it were current.
- Log provider, tool, timestamp, latency, result status and errors without logging unnecessary passenger data.
- Provide a graceful fallback when an external service is unavailable.
- Allow provider disablement through configuration.
- Keep Stanley's visual presentation independent of the MCP provider.

# 11. What to demonstrate to Princess

Build one cohesive demonstration around a hypothetical Caribbean or Mediterranean sailing. Stanley would:

1. Search and compare cruises through an external cruise MCP.
2. Retrieve information about the ship and itinerary.
3. Discover experiences in an upcoming port using GoVisit.
4. Calculate walking routes using OpenStreetMap.
5. Check port-day weather through a properly licensed service.
6. Suggest a suitable itinerary based on passenger preferences.
7. Incorporate the actual ship timetable from the PWA's own voyage data.
8. Display everything in a polished visual passenger experience.

Then show the MCP gateway and explain:

> Today, the demonstration uses independent travel-service MCP providers. The integration architecture is designed to connect to Mobi's Princess-specific MCP infrastructure once Princess grants appropriate access. The passenger experience and Stanley intelligence remain unchanged.

This is stronger than merely saying that the application is MCP-ready. It demonstrates live external tool use, combined results and a provider-independent design.

# 12. Overall recommendation

Start with three integrations:

| Service | Priority | Role |
|---|---|---|
| GoVisit | First | Destination knowledge and attraction discovery |
| Siloah Travel | Second | Cruise searches and ship information, after verifying coverage and rights |
| OpenStreetMap | Third | Walking routes and geographic intelligence through your own deployment |

Add flights and weather as supporting integrations after the first demonstration works reliably and commercial permissions are understood.

Include the capability in the Princess acquisition proposal under the heading **Extensible MCP-Based Travel Intelligence Architecture**.

Suggested acquisition-proposal language:

> The platform is designed to support standardized Model Context Protocol integrations, enabling Stanley to discover and interact with external travel services, destination information providers and authorized Princess enterprise systems.
>
> The architecture supports multiple AI model providers and external MCP services through a controlled integration layer, allowing Princess to introduce new capabilities without rebuilding the passenger experience.
>
> The initial platform can demonstrate live connections to independent MCP services, with a defined pathway to integrate Mobi-managed Princess MCP services once appropriate commercial authorization and technical access are available.

The central commercial message is not that the PWA has connected to a few free MCP servers. It is that **the passenger experience and integration architecture have been designed to connect Stanley to Princess's own services when authorized access becomes available.**

---

# Appendix A — Provider links

- Siloah Travel MCP: https://github.com/siloah-travel/siloah-travel-mcp
- CruiseHops MCP: https://cruisehops.com/integrations
- GoVisit MCP: https://govisit.ai/en/docs/developers/mcp/overview
- GetExperience MCP: https://github.com/SKurakov/getexperience-mcp
- Peek MCP listing: https://mcphub.travel/servers/peek
- OpenStreetMap MCP: https://github.com/ni-c/osm-mcp
- Open-Meteo MCP: https://github.com/cyanheads/open-meteo-mcp-server
- Open-Meteo pricing and terms: https://open-meteo.com/en/pricing
- OctoTrip Flights: https://github.com/OctoTrip/flights
- Currency Converter MCP: https://mcphub.travel/servers/currency-converter
- MCP specification: https://modelcontextprotocol.io/specification/latest

# Appendix B — Important qualifications

1. “Free” can mean publicly accessible, no API key, free server software, or a free tier. These are not the same thing. Underlying data/API terms may still restrict commercial use.
2. Public endpoint availability and coverage can change. Verify each endpoint's current behavior, transport, rate limits, authentication and terms before use.
3. Public third-party cruise information is not authoritative Princess inventory, live cabin availability or a confirmed Princess fare.
4. A provider's open-source server licence does not automatically cover third-party data exposed by the server.
5. An MCP server can use Streamable HTTP while still requiring OAuth or another authentication method. Open protocol does not mean open access.
6. MCP standardizes communication and tool invocation, not business semantics. A Mobi integration will require tool/schema mapping and authorization even if it uses the same protocol.
7. Do not present simulated or third-party information as official Princess information.

# Appendix C — Research references and documentation

The source links below were used to review the providers and technical claims. Check current documentation and license terms before production or commercial deployment.

- MCP protocol: https://modelcontextprotocol.io/specification/latest
- Siloah repository and README: https://github.com/siloah-travel/siloah-travel-mcp
- CruiseHops MCP docs and terms: https://cruisehops.com/integrations
- GoVisit MCP overview: https://govisit.ai/en/docs/developers/mcp/overview
- GoVisit data-use policy: https://govisit.ai/en/docs/developers/data-use-license
- GetExperience MCP repository: https://github.com/SKurakov/getexperience-mcp
- Peek MCP listing: https://mcphub.travel/servers/peek
- osm-mcp repository: https://github.com/ni-c/osm-mcp
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- Open-Meteo MCP repository: https://github.com/cyanheads/open-meteo-mcp-server
- Open-Meteo pricing: https://open-meteo.com/en/pricing
- OctoTrip Flights repository: https://github.com/OctoTrip/flights
- Currency Converter MCP listing: https://mcphub.travel/servers/currency-converter

*This document is a technical and commercial planning recommendation. It is not a guarantee that the listed providers will remain freely accessible, provide complete data, or permit the proposed commercial uses. Provider access, coverage and licensing must be verified before integration and before any Princess-facing production commitment.*
