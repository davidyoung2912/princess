using System.Text.Json;

namespace Princess.Api.Domain;

public sealed record ShipFactsDto(string Id, string Name, string ClassName, int Entered, int Tonnage, string Length, int Guests, int Crew, int Staterooms, int AccessibleStaterooms, int ConnectingStaterooms, int Decks, int SanctuaryStaterooms, string Intro);
public sealed record ShipHighlightDto(string Title, string Body);
public sealed record StateroomCategoryDto(string Id, string Name, string Code, string Size, string View, string Summary, double Ratio, bool? Suite);
public sealed record OtherShipDto(string Name, string Note, int Guests, int Entered);
public sealed record DeckPlaceDto(string Id, string Name, int Deck, string Section, string Kind, bool StepFree, string? Note);
public sealed record ElevatorBankDto(string Bank, string Section, string Side);
public sealed record MusterStationDto(string Letter, string Name, string PlaceId, int Deck);

/// <summary>The ship, its stateroom categories, the deck plan, the six elevator banks and the muster stations (multi-device plan 3, Phase 3 step 2). <c>Version</c> changes when the content does.</summary>
public sealed record ShipReferenceDto(string Version, ShipFactsDto Ship, IReadOnlyList<ShipHighlightDto> Highlights, IReadOnlyList<StateroomCategoryDto> Categories, IReadOnlyList<string> Accessibility,
    IReadOnlyList<OtherShipDto> OtherShips, IReadOnlyList<DeckPlaceDto> Places, IReadOnlyList<ElevatorBankDto> Elevators, IReadOnlyList<MusterStationDto> Muster);

/// <summary>Authored ship reference content, moved from <c>ship.ts</c> and <c>deck.ts</c> on the client. Places follow the ship profile; deck and position are authored where the profile is silent (verify before real use).</summary>
public static class ShipReference
{
    private sealed record Body(ShipFactsDto Ship, List<ShipHighlightDto> Highlights, List<StateroomCategoryDto> Categories, List<string> Accessibility, List<OtherShipDto> OtherShips, List<DeckPlaceDto> Places, List<ElevatorBankDto> Elevators, List<MusterStationDto> Muster);

    private static readonly Lazy<ShipReferenceDto> Parsed = new(() =>
    {
        var b = JsonSerializer.Deserialize<Body>(Json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(Json))).ToLowerInvariant()[..16];
        return new ShipReferenceDto(version, b.Ship, b.Highlights, b.Categories, b.Accessibility, b.OtherShips, b.Places, b.Elevators, b.Muster);
    });

    public static ShipReferenceDto Get() => Parsed.Value;

    private const string Json = """
{
 "ship": {
  "id": "sun-princess",
  "name": "Sun Princess",
  "className": "Sphere class",
  "entered": 2024,
  "tonnage": 177882,
  "length": "1,133 ft",
  "guests": 4300,
  "crew": 1600,
  "staterooms": 2157,
  "accessibleStaterooms": 51,
  "connectingStaterooms": 100,
  "decks": 17,
  "sanctuaryStaterooms": 215,
  "intro": "Princess’s newest ship, built around the Piazza, a three-level gathering place under a glass Sphere, and the Dome, a glass-roofed pool by day and a theatre by night."
 },
 "highlights": [
  {
   "title": "The Piazza",
   "body": "The heart of the ship: a three-level gathering place under the glass Sphere, open from morning coffee until late. Each level has cafés, bars and live music, and through the day there are game shows, roaming performers and dancing. It is the easiest place to meet your group, so many guests make it their usual meeting point."
  },
  {
   "title": "The Dome",
   "body": "A glass dome on decks 17 and 18. By day it is a pool and lounge with views out to sea in any weather. By night it becomes a theatre with acrobatic shows, and late in the evening it turns into a dance party. Show times appear in Today’s Plan, and seats go quickly, so arrive early."
  },
  {
   "title": "Princess Arena",
   "body": "The main show venue, seating about 900. The seating is set up three ways (a traditional stage, a keyhole and in the round) so each production can use the room differently. Arrive about half an hour early for a good seat, and ask a crew member about wheelchair-accessible places."
  },
  {
   "title": "Dining included",
   "body": "Three dining rooms serve breakfast, lunch and dinner at no extra charge, with menus that change each night. The Eatery buffet, the Americana Diner, casual grills and pizza are open through the day, and room service runs 24 hours. Menus flag dietary needs and allergens, and you can tell your server about them on your first night."
  },
  {
   "title": "Specialty dining",
   "body": "Steakhouse, Italian, seafood, sushi, teppanyaki and a prix fixe with sea views. Each is at an extra charge unless your package covers it, and tables are limited, so reserve before you sail or on the first day. Stanley can check what your package covers and book a table for you."
  },
  {
   "title": "Kids and teens",
   "body": "Three clubs by age, all on decks 6 and 7: Firefly Park (3–7), Neon Grove (8–12) and The Underground (13–17). Each has games, crafts, sports and evening activities led by youth staff. Register your children before you sail so signing in at the door is quick, and ask staff about pickup and sign-out rules."
  },
  {
   "title": "The Sanctuary",
   "body": "An adults-only retreat on deck 18 for guests in the Sanctuary Collection of 215 staterooms. It is a quieter place to lounge, with its own bar and dining, away from the busier decks. Guests under 18 are not admitted."
  }
 ],
 "categories": [
  {
   "id": "interior",
   "name": "Interior",
   "code": "IF",
   "size": "135–145 sq ft",
   "view": "No window",
   "summary": "The best-value way to sail. Sleeps two to four, with two lower beds that can be made into a queen and pull-down beds for a third and fourth guest. There is no window, so the room stays dark and quiet for sleeping in. Every room has a private bathroom with a shower, a desk, a TV and a safe, and you have the same access to everything on the ship as in any other room.",
   "ratio": 1
  },
  {
   "id": "oceanview",
   "name": "Premium Oceanview",
   "code": "OV",
   "size": "About 215 sq ft",
   "view": "Large window, no balcony",
   "summary": "Daylight and a sea view without a balcony, through a large picture window. Sleeps two to three, with a sitting area, a desk and a private bathroom. A good middle choice if you want to watch each port arrive but would rather not pay for a balcony.",
   "ratio": 1.22
  },
  {
   "id": "balcony",
   "name": "Deluxe Balcony",
   "code": "BF",
   "size": "About 236 sq ft",
   "view": "Private balcony",
   "summary": "Sofa bed, desk, mini-fridge and a balcony to watch each port arrive. Sleeps two to four, with two lower beds that can be made into a queen and a private bathroom with a shower. Step outside for fresh air, an unhurried breakfast and the sunset.",
   "ratio": 1.45
  },
  {
   "id": "miniSuite",
   "name": "Mini-Suite",
   "code": "MB",
   "size": "Larger than a balcony",
   "view": "Private balcony",
   "summary": "Extra room, a sitting area and a larger bathroom. A sofa bed makes space for a third guest, and there is a private balcony. A good choice for a family of three or four, or for anyone who spends a lot of time in the room. Suite guests pay the higher daily gratuity.",
   "ratio": 1.9,
   "suite": true
  },
  {
   "id": "sanctuaryMiniSuite",
   "name": "Sanctuary Mini-Suite",
   "code": "M1",
   "size": "Mini-suite size",
   "view": "Private balcony",
   "summary": "Includes the adults-only Sanctuary, the Sanctuary restaurant and the Premier package, which bundles extras such as drinks, Wi-Fi and specialty dining. Part of the Sanctuary Collection of 215 staterooms, with a private balcony and the extra room of a mini-suite. Suite guests pay the higher daily gratuity.",
   "ratio": 2.45,
   "suite": true
  },
  {
   "id": "signatureSuite",
   "name": "Signature Suite",
   "code": "SS",
   "size": "About 270 sq ft plus balcony",
   "view": "Large balcony",
   "summary": "Suite lounge access, priority boarding and the Premier package. The largest rooms on the ship, with a large balcony, a separate living area and space to sleep up to four. Suite guests pay the higher daily gratuity.",
   "ratio": 3.4,
   "suite": true
  }
 ],
 "accessibility": [
  "51 accessible staterooms, with roll-in showers and wider doors.",
  "Six elevator banks with touchscreens that assign a car; interactive deck maps beside each bank.",
  "Wheelchair-accessible seating in the Arena, the Piazza and the main dining rooms.",
  "Belize City is a tender port: the boats have steps, and mobility help there is limited. Ask Guest Services before you book a shore day.",
  "Tell Princess about a wheelchair, scooter or other need at least 30 days before you sail."
 ],
 "otherShips": [
  {
   "name": "Star Princess",
   "note": "Sun Princess’s sister ship, also Sphere class.",
   "guests": 4300,
   "entered": 2025
  },
  {
   "name": "Sky Princess",
   "note": "Grand class, known for the SeaWalk over the side of the ship.",
   "guests": 3660,
   "entered": 2019
  },
  {
   "name": "Enchanted Princess",
   "note": "Royal class, with a larger spa and plenty of casual dining.",
   "guests": 3660,
   "entered": 2020
  }
 ],
 "places": [
  {
   "id": "landing",
   "name": "The Landing (gangway)",
   "deck": 4,
   "section": "midship",
   "kind": "service",
   "stepFree": true
  },
  {
   "id": "wc-7",
   "name": "Restrooms by the Piazza",
   "deck": 7,
   "section": "midship",
   "kind": "restroom",
   "stepFree": true,
   "note": "Step-free and accessible stalls; a family restroom is next door"
  },
  {
   "id": "wc-9",
   "name": "Restrooms by the Promenade",
   "deck": 9,
   "section": "aft",
   "kind": "restroom",
   "stepFree": true,
   "note": "Step-free and accessible stalls"
  },
  {
   "id": "wc-17",
   "name": "Restrooms at the Lido",
   "deck": 17,
   "section": "aft",
   "kind": "restroom",
   "stepFree": true,
   "note": "Step-free and accessible stalls; baby changing"
  },
  {
   "id": "medical",
   "name": "Medical Center",
   "deck": 4,
   "section": "forward",
   "kind": "medical",
   "stepFree": true
  },
  {
   "id": "soleil",
   "name": "Soleil Dining Room",
   "deck": 6,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "guest-services",
   "name": "Guest Services",
   "deck": 6,
   "section": "forward",
   "kind": "service",
   "stepFree": true
  },
  {
   "id": "firefly",
   "name": "Firefly Park",
   "deck": 6,
   "section": "forward",
   "kind": "family",
   "stepFree": true
  },
  {
   "id": "lotus",
   "name": "Lotus Spa",
   "deck": 6,
   "section": "midship",
   "kind": "wellness",
   "stepFree": true
  },
  {
   "id": "eclipse",
   "name": "Eclipse Dining Room",
   "deck": 7,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "crown",
   "name": "Crown Grill",
   "deck": 7,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "catch",
   "name": "The Catch by Rudi",
   "deck": 7,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "omalleys",
   "name": "O’Malley’s Irish Pub",
   "deck": 7,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "piazza",
   "name": "The Piazza",
   "deck": 7,
   "section": "midship",
   "kind": "show",
   "stepFree": true,
   "note": "Three levels; each has a lift to the others"
  },
  {
   "id": "arena",
   "name": "Princess Arena",
   "deck": 7,
   "section": "forward",
   "kind": "show",
   "stepFree": true,
   "note": "Wheelchair spaces on both sides of the middle block; ask an usher"
  },
  {
   "id": "live",
   "name": "Princess Live!",
   "deck": 7,
   "section": "forward",
   "kind": "show",
   "stepFree": true
  },
  {
   "id": "neon-grove",
   "name": "Neon Grove Tweens Club",
   "deck": 7,
   "section": "forward",
   "kind": "family",
   "stepFree": true
  },
  {
   "id": "underground",
   "name": "The Underground Teen Lounge",
   "deck": 7,
   "section": "forward",
   "kind": "family",
   "stepFree": true
  },
  {
   "id": "bellinis",
   "name": "Bellini’s Cocktail Bar",
   "deck": 7,
   "section": "midship",
   "kind": "bar",
   "stepFree": true
  },
  {
   "id": "coffee-currents",
   "name": "Coffee Currents",
   "deck": 7,
   "section": "midship",
   "kind": "bar",
   "stepFree": true
  },
  {
   "id": "wheelhouse",
   "name": "Wheelhouse Bar",
   "deck": 7,
   "section": "aft",
   "kind": "bar",
   "stepFree": true
  },
  {
   "id": "shops",
   "name": "Shops of Princess",
   "deck": 8,
   "section": "midship",
   "kind": "shop",
   "stepFree": true
  },
  {
   "id": "sabatini",
   "name": "Sabatini’s",
   "deck": 8,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "crooners",
   "name": "Crooners",
   "deck": 8,
   "section": "midship",
   "kind": "bar",
   "stepFree": true
  },
  {
   "id": "casino",
   "name": "Princess Casino",
   "deck": 8,
   "section": "forward",
   "kind": "show",
   "stepFree": true
  },
  {
   "id": "oceanfront",
   "name": "OceanFront (Medallion help)",
   "deck": 8,
   "section": "midship",
   "kind": "service",
   "stepFree": true
  },
  {
   "id": "eatery",
   "name": "The Eatery",
   "deck": 9,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "alfredo",
   "name": "Alfredo’s Pizzeria",
   "deck": 9,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "americana",
   "name": "Americana Diner",
   "deck": 9,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "promenade",
   "name": "Promenade (outdoor)",
   "deck": 9,
   "section": "aft",
   "kind": "pool",
   "stepFree": true,
   "note": "Gentle ramps at each door; the deck is flat"
  },
  {
   "id": "intl-cafe",
   "name": "International Café",
   "deck": 9,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "excursions-desk",
   "name": "Shore Excursions desk",
   "deck": 9,
   "section": "midship",
   "kind": "service",
   "stepFree": true
  },
  {
   "id": "lido",
   "name": "The Lido (Lido Eats)",
   "deck": 17,
   "section": "midship",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "love",
   "name": "Love by Britto",
   "deck": 17,
   "section": "aft",
   "kind": "dining",
   "stepFree": true
  },
  {
   "id": "lido-pool",
   "name": "Lido Pool",
   "deck": 17,
   "section": "midship",
   "kind": "pool",
   "stepFree": true,
   "note": "Pool lift at the shallow end"
  },
  {
   "id": "sea-view",
   "name": "Sea View Bar",
   "deck": 17,
   "section": "forward",
   "kind": "bar",
   "stepFree": true
  },
  {
   "id": "dome",
   "name": "The Dome",
   "deck": 17,
   "section": "midship",
   "kind": "show",
   "stepFree": true,
   "note": "Step-free from the Lido; seats and open spaces for wheelchairs"
  },
  {
   "id": "sun-bar",
   "name": "Sun Bar",
   "deck": 18,
   "section": "forward",
   "kind": "bar",
   "stepFree": false,
   "note": "Two steps up from the sun deck. The Sea View Bar on deck 17 serves the same drinks, step-free"
  },
  {
   "id": "fitness",
   "name": "Fitness Center",
   "deck": 18,
   "section": "midship",
   "kind": "wellness",
   "stepFree": true
  },
  {
   "id": "salon",
   "name": "Lotus Salon",
   "deck": 18,
   "section": "midship",
   "kind": "wellness",
   "stepFree": true
  }
 ],
 "elevators": [
  {
   "bank": "A",
   "section": "forward",
   "side": "port"
  },
  {
   "bank": "B",
   "section": "forward",
   "side": "starboard"
  },
  {
   "bank": "C",
   "section": "midship",
   "side": "port"
  },
  {
   "bank": "D",
   "section": "midship",
   "side": "starboard"
  },
  {
   "bank": "E",
   "section": "aft",
   "side": "port"
  },
  {
   "bank": "F",
   "section": "aft",
   "side": "starboard"
  }
 ],
 "muster": [
  {
   "letter": "A",
   "name": "Princess Arena, port side",
   "placeId": "arena",
   "deck": 7
  },
  {
   "letter": "B",
   "name": "Princess Live!, starboard side",
   "placeId": "live",
   "deck": 7
  },
  {
   "letter": "C",
   "name": "The Piazza, port side",
   "placeId": "piazza",
   "deck": 7
  },
  {
   "letter": "D",
   "name": "The Piazza, starboard side",
   "placeId": "piazza",
   "deck": 7
  },
  {
   "letter": "E",
   "name": "Eclipse Dining Room",
   "placeId": "eclipse",
   "deck": 7
  },
  {
   "letter": "F",
   "name": "Soleil Dining Room",
   "placeId": "soleil",
   "deck": 6
  }
 ]
}
""";
}
