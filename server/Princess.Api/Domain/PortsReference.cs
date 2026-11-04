using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>
/// Authored port guides, port knowledge (fair taxi prices, scam alerts, phrases, allergy cards, walks, day passes, family notes, vendors) and map
/// coordinates, moved from <c>ports.ts</c> and <c>portContent.ts</c> on the client (multi-device plan 3, Phase 3 step 4). Values are concept samples:
/// verify prices, rules and hours before real use. Served whole as <c>GET /reference/ports</c> with a content <c>version</c>.
/// </summary>
public static class PortsReference
{
    private static readonly Lazy<JsonNode> Parsed = new(() =>
    {
        var node = JsonNode.Parse(Json)!.AsObject();
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Json))).ToLowerInvariant()[..16];
        var result = new JsonObject { ["version"] = version };
        foreach (var kv in node.ToList()) { node.Remove(kv.Key); result[kv.Key] = kv.Value; }
        return result;
    });

    public static JsonNode Get() => Parsed.Value;

    private const string Json = """
{
 "guides": {
  "fll": {
   "id": "fll",
   "short": "Fort Lauderdale",
   "landing": "pier",
   "blurb": "Port Everglades, about 5 miles from the airport. You board here on day 1 and leave on day 8.",
   "bestTime": "Winter is dry and mild, the busiest season for sailing.",
   "access": "Level terminal with wheelchair assistance from the curb. Ask for assistance when you check in online.",
   "doThis": [
    "Arrive at your check-in time, not earlier",
    "Fly in the day before if you can",
    "Stay at an airport hotel with a shuttle"
   ],
   "excursions": []
  },
  "cozumel": {
   "id": "cozumel",
   "short": "Cozumel",
   "landing": "pier",
   "blurb": "A Mexican island with clear water, beach clubs and the Mayan ruins at San Gervasio. The ship docks at a pier, so there is no tender.",
   "bestTime": "November to April is dry and warm. Hurricane season runs June to November.",
   "access": "Pier dock with a flat walk to shops and taxis. Beach clubs are a short taxi ride; most have level paths but soft sand.",
   "doThis": [
    "Snorkel the Palancar Reef",
    "Visit San Gervasio ruins",
    "Relax at a beach club",
    "Shop at the pier"
   ],
   "excursions": [
    {
     "id": "coz-snorkel",
     "name": "Reef snorkel by boat",
     "hours": 3.5,
     "price": 79,
     "access": "some"
    },
    {
     "id": "coz-ruins",
     "name": "San Gervasio Mayan ruins",
     "hours": 4,
     "price": 69,
     "access": "some"
    },
    {
     "id": "coz-beach",
     "name": "Beach club day pass",
     "hours": 6,
     "price": 59,
     "access": "easy"
    }
   ]
  },
  "belize": {
   "id": "belize",
   "short": "Belize City",
   "landing": "tender",
   "blurb": "Home to the Belize Barrier Reef, Mayan temples and jungle caves. The ship anchors offshore and small boats, called tenders, carry you in.",
   "bestTime": "February to May is driest. Showers are common the rest of the year.",
   "access": "Tender boats have steps and a gap to step across. Guests who cannot manage steps may be unable to go ashore, and staff cannot lift a wheelchair. Plan with Guest Services before you book.",
   "doThis": [
    "Tour the Altun Ha temples",
    "Tube through a jungle cave",
    "Snorkel the reef",
    "Visit Lamanai by river"
   ],
   "excursions": [
    {
     "id": "bze-altunha",
     "name": "Altun Ha Mayan temples",
     "hours": 4,
     "price": 85,
     "access": "some"
    },
    {
     "id": "bze-cave",
     "name": "Cave tubing adventure",
     "hours": 6,
     "price": 129,
     "access": "demanding"
    },
    {
     "id": "bze-reef",
     "name": "Barrier reef snorkel",
     "hours": 4,
     "price": 99,
     "access": "some"
    }
   ]
  },
  "roatan": {
   "id": "roatan",
   "short": "Roatán",
   "landing": "pier",
   "blurb": "A Honduran island with white beaches, reef snorkelling and wildlife parks. The ship docks at a pier beside shops and a beach.",
   "bestTime": "February to June is driest. October to January is the rainy season.",
   "access": "Level pier and a short walk to shops and a beach. Taxis and tour vans wait at the gate; vans may have a step up.",
   "doThis": [
    "Zip-line over the canopy",
    "Snorkel West Bay",
    "See sloths and monkeys",
    "Walk the beach by the pier"
   ],
   "excursions": [
    {
     "id": "rtb-zip",
     "name": "Zip-line canopy tour",
     "hours": 3,
     "price": 89,
     "access": "demanding"
    },
    {
     "id": "rtb-snorkel",
     "name": "West Bay snorkel",
     "hours": 3.5,
     "price": 75,
     "access": "some"
    },
    {
     "id": "rtb-wildlife",
     "name": "Wildlife and monkey park",
     "hours": 3,
     "price": 65,
     "access": "easy"
    }
   ]
  },
  "celebration-key": {
   "id": "celebration-key",
   "short": "Celebration Key",
   "landing": "pier",
   "blurb": "A private destination on Grand Bahama built for cruise guests, with lagoon beaches, pools and a short walk from the pier. Almost everything is inside the gates.",
   "bestTime": "December to April is dry and mild. Hurricane season runs June to November.",
   "access": "Level paths from the pier to the beach and pools; beach wheelchairs and shaded seating are available (ask on arrival).",
   "doThis": [
    "Float in the lagoon",
    "Swim at the main beach",
    "Take a short island tour",
    "Browse the craft market"
   ],
   "excursions": [
    {
     "id": "cele-x1",
     "name": "Lagoon and beach day",
     "hours": 6,
     "price": 0,
     "access": "easy"
    },
    {
     "id": "cele-x2",
     "name": "Island sightseeing tour",
     "hours": 3,
     "price": 55,
     "access": "easy"
    }
   ]
  },
  "grand-turk": {
   "id": "grand-turk",
   "short": "Grand Turk",
   "landing": "pier",
   "blurb": "A small Caribbean island with a cruise pier that opens onto a beach, shops and a lighthouse. Reefs and a drop-off close to shore make it a favourite for snorkelling.",
   "bestTime": "December to April is driest. Hurricane season runs June to November.",
   "access": "Level pier and a flat walk to the beach and shops. Beyond the complex, roads are rougher and taxis are vans or open cars.",
   "doThis": [
    "Snorkel the reef",
    "Visit the lighthouse and old town",
    "Relax at Cockburn Town beach",
    "Watch for wild donkeys"
   ],
   "excursions": [
    {
     "id": "gran-x1",
     "name": "Reef and wall snorkel",
     "hours": 3,
     "price": 75,
     "access": "some"
    },
    {
     "id": "gran-x2",
     "name": "Island sightseeing",
     "hours": 2.5,
     "price": 50,
     "access": "easy"
    }
   ]
  },
  "san-juan": {
   "id": "san-juan",
   "short": "San Juan",
   "landing": "pier",
   "blurb": "The capital of Puerto Rico, a US territory. The old city sits by the cruise piers, with blue cobbled streets, forts and plazas within walking distance.",
   "bestTime": "December to April is driest and cooler. Hurricane season runs June to November.",
   "access": "Piers are close to Old San Juan. Streets are cobbled and steep in places; the trolley is free but boarding may need help. Taxis have fixed fares from the piers.",
   "doThis": [
    "Walk the walls of El Morro",
    "Stroll Calle del Cristo",
    "Visit San Cristóbal fort",
    "Eat mofongo"
   ],
   "excursions": [
    {
     "id": "san--x1",
     "name": "Old San Juan forts and history",
     "hours": 3.5,
     "price": 59,
     "access": "some"
    },
    {
     "id": "san--x2",
     "name": "El Yunque rainforest",
     "hours": 6,
     "price": 99,
     "access": "demanding"
    }
   ]
  },
  "amber-cove": {
   "id": "amber-cove",
   "short": "Amber Cove",
   "landing": "pier",
   "blurb": "A purpose-built cruise port near Puerto Plata on the north coast of the Dominican Republic, with a pool, shops and a beach beside the pier.",
   "bestTime": "December to April is driest. Hurricane season runs June to November.",
   "access": "Level paths from the pier to the pool, shops and beach. Tours leave from the pier in vans; some have a step up.",
   "doThis": [
    "Take the Puerto Plata cable car",
    "Relax at the pool and beach",
    "Visit the old town",
    "Try local coffee and cacao"
   ],
   "excursions": [
    {
     "id": "ambe-x1",
     "name": "Puerto Plata cable car and city",
     "hours": 5,
     "price": 69,
     "access": "some"
    },
    {
     "id": "ambe-x2",
     "name": "Waterfall tour",
     "hours": 6,
     "price": 89,
     "access": "demanding"
    }
   ]
  },
  "southampton": {
   "id": "southampton",
   "short": "Southampton",
   "landing": "pier",
   "blurb": "England’s cruise gateway on the south coast. Terminals are close to the city centre, with rail links to London in about 90 minutes.",
   "bestTime": "May to September is warmest and driest; rain is possible in any month.",
   "access": "Terminals are level with assistance on request. Taxis and the Southampton Central rail station are a short ride from the terminals.",
   "doThis": [
    "Walk the medieval walls",
    "Visit SeaCity Museum",
    "Take a train to Winchester or London",
    "Browse the Oxford Street cafés"
   ],
   "excursions": [
    {
     "id": "sout-x1",
     "name": "Stonehenge and Salisbury",
     "hours": 9,
     "price": 129,
     "access": "some"
    },
    {
     "id": "sout-x2",
     "name": "Winchester city tour",
     "hours": 6,
     "price": 99,
     "access": "some"
    }
   ]
  },
  "barcelona": {
   "id": "barcelona",
   "short": "Barcelona",
   "landing": "pier",
   "blurb": "A Catalan port city with Gaudí buildings, a medieval Gothic Quarter and a waterfront. The terminals are a shuttle or short taxi from La Rambla.",
   "bestTime": "May to June and September to October are warm and less crowded. July and August are hot and busy.",
   "access": "Terminals are level. Shuttle buses and taxis run to the centre; the Metro has steps. The Gothic Quarter is cobbled and narrow.",
   "doThis": [
    "See La Sagrada Família",
    "Walk La Rambla and the Gothic Quarter",
    "Eat tapas at the Boqueria",
    "Ride the cable car to Montjuïc"
   ],
   "excursions": [
    {
     "id": "barc-x1",
     "name": "Sagrada Família and Park Güell",
     "hours": 5,
     "price": 99,
     "access": "some"
    },
    {
     "id": "barc-x2",
     "name": "Gothic Quarter walking tour",
     "hours": 3,
     "price": 59,
     "access": "some"
    }
   ]
  },
  "palma": {
   "id": "palma",
   "short": "Palma de Mallorca",
   "landing": "pier",
   "blurb": "The capital of Mallorca, with a huge Gothic cathedral on the sea front, an old town of courtyards and beaches close by. The pier is about 3 km from the centre.",
   "bestTime": "May to June and September to October are warm. July and August are hot and busy.",
   "access": "Terminals are level. Shuttle and taxis cover the 3 km to the cathedral. The old town is cobbled and has some slopes.",
   "doThis": [
    "Visit La Seu cathedral",
    "Wander the old town courtyards",
    "Relax on a nearby beach",
    "Ride the old train to Sóller"
   ],
   "excursions": [
    {
     "id": "palm-x1",
     "name": "Palma highlights and cathedral",
     "hours": 4,
     "price": 65,
     "access": "some"
    },
    {
     "id": "palm-x2",
     "name": "Sóller by train and tram",
     "hours": 6,
     "price": 89,
     "access": "some"
    }
   ]
  },
  "marseille": {
   "id": "marseille",
   "short": "Marseille",
   "landing": "pier",
   "blurb": "France’s oldest city, a busy Mediterranean port with the Old Port, the hilltop basilica of Notre-Dame de la Garde and the coastal Calanques nearby.",
   "bestTime": "May to June and September are warm and bright. July and August are hot.",
   "access": "Terminals are level. The Old Port is a shuttle or short taxi away; the basilica is a steep climb or a bus ride.",
   "doThis": [
    "Walk the Old Port",
    "Climb to Notre-Dame de la Garde",
    "Eat bouillabaisse",
    "Visit Le Panier"
   ],
   "excursions": [
    {
     "id": "mars-x1",
     "name": "Calanques boat trip",
     "hours": 4,
     "price": 69,
     "access": "some"
    },
    {
     "id": "mars-x2",
     "name": "Aix-en-Provence day trip",
     "hours": 6,
     "price": 89,
     "access": "some"
    }
   ]
  },
  "genoa": {
   "id": "genoa",
   "short": "Genoa",
   "landing": "pier",
   "blurb": "A historic port city with palaces on Via Garibaldi, a maze of medieval alleys (caruggi) and Europe’s largest aquarium. The terminals are within walking distance of the centre.",
   "bestTime": "April to June and September to October are mild. July and August are hot.",
   "access": "Terminals are level; the old town is a flat walk. Alleys are narrow and cobbled; steep funiculars climb the hillside.",
   "doThis": [
    "Walk the caruggi",
    "See the Palazzi dei Rolli",
    "Visit the aquarium",
    "Eat pesto and focaccia"
   ],
   "excursions": [
    {
     "id": "geno-x1",
     "name": "Portofino and Santa Margherita",
     "hours": 5,
     "price": 79,
     "access": "some"
    },
    {
     "id": "geno-x2",
     "name": "Genoa old town walk",
     "hours": 3,
     "price": 49,
     "access": "some"
    }
   ]
  },
  "la-spezia": {
   "id": "la-spezia",
   "short": "La Spezia",
   "landing": "pier",
   "blurb": "The gateway to the Cinque Terre and Portovenere. The port is close to the town and station, with trains to the villages in 10 to 20 minutes.",
   "bestTime": "April to June and September to October are mild and less crowded than midsummer.",
   "access": "Terminals are level and the station is a short walk. Villages have steps and steep lanes; trains and ferries are the main way along the coast.",
   "doThis": [
    "Take the train to Monterosso or Vernazza",
    "Visit Portovenere",
    "Walk part of the coastal path",
    "Eat focaccia and anchovies"
   ],
   "excursions": [
    {
     "id": "la-s-x1",
     "name": "Cinque Terre by train and ferry",
     "hours": 7,
     "price": 99,
     "access": "demanding"
    },
    {
     "id": "la-s-x2",
     "name": "Portovenere and Lerici by boat",
     "hours": 5,
     "price": 79,
     "access": "some"
    }
   ]
  },
  "civitavecchia": {
   "id": "civitavecchia",
   "short": "Civitavecchia (Rome)",
   "landing": "pier",
   "blurb": "The port for Rome, about 80 km away. Most guests take the train (about an hour) or a tour to the city; allow plenty of time before all-aboard.",
   "bestTime": "April to June and September to October are warm; July and August are very hot in Rome.",
   "access": "Terminals are level. A shuttle runs to the station. Rome’s sights involve long walks on cobbles; plan rest stops.",
   "doThis": [
    "See the Colosseum and Forum",
    "Toss a coin in the Trevi Fountain",
    "Visit St Peter’s Square",
    "Eat pasta and gelato"
   ],
   "excursions": [
    {
     "id": "civi-x1",
     "name": "Rome highlights",
     "hours": 9,
     "price": 129,
     "access": "demanding"
    },
    {
     "id": "civi-x2",
     "name": "Vatican and Sistine Chapel",
     "hours": 8,
     "price": 139,
     "access": "some"
    }
   ]
  },
  "naples": {
   "id": "naples",
   "short": "Naples",
   "landing": "pier",
   "blurb": "A lively city under Vesuvius, with the birthplace of pizza, a huge archaeological museum and the ruins of Pompeii nearby. The terminal is beside the old town.",
   "bestTime": "April to June and September to October are warm. July and August are very hot.",
   "access": "Terminals are level. The old town is cobbled and busy; Pompeii and Herculaneum involve long walks on rough stone.",
   "doThis": [
    "Eat a Neapolitan pizza",
    "Visit Pompeii",
    "Climb Vesuvius",
    "See the Archaeological Museum"
   ],
   "excursions": [
    {
     "id": "napl-x1",
     "name": "Pompeii and Vesuvius",
     "hours": 8,
     "price": 119,
     "access": "demanding"
    },
    {
     "id": "napl-x2",
     "name": "Amalfi Coast drive",
     "hours": 9,
     "price": 129,
     "access": "some"
    }
   ]
  },
  "athens": {
   "id": "athens",
   "short": "Athens (Piraeus)",
   "landing": "pier",
   "blurb": "The port for Athens, about 12 km from the Acropolis. The Metro runs from Piraeus to the centre in about 25 minutes.",
   "bestTime": "April to June and September to October are warm. July and August are very hot.",
   "access": "Terminals are level. The Metro station is a short walk or shuttle. The Acropolis rock is steep with uneven marble, and queues are long.",
   "doThis": [
    "Visit the Acropolis",
    "Walk the Plaka",
    "See the Acropolis Museum",
    "Try souvlaki"
   ],
   "excursions": [
    {
     "id": "athe-x1",
     "name": "Acropolis and Athens highlights",
     "hours": 5,
     "price": 89,
     "access": "demanding"
    },
    {
     "id": "athe-x2",
     "name": "Cape Sounion and Temple of Poseidon",
     "hours": 5,
     "price": 79,
     "access": "some"
    }
   ]
  },
  "santorini": {
   "id": "santorini",
   "short": "Santorini",
   "landing": "tender",
   "blurb": "A volcanic island of whitewashed villages on the rim of a flooded crater. The ship anchors in the caldera; guests go ashore by tender and climb to Fira by cable car, donkey or steps.",
   "bestTime": "May to June and September to October are warm and less crowded. July and August are hot.",
   "access": "Tender, then a cable car or 580 steps to Fira. Streets are steep, cobbled and often crowded. Taxis and buses run to Oia and the beaches.",
   "doThis": [
    "Ride the cable car to Fira",
    "See sunset at Oia (if time allows)",
    "Taste local wine",
    "Walk the caldera path"
   ],
   "excursions": [
    {
     "id": "sant-x1",
     "name": "Santorini highlights and winery",
     "hours": 5,
     "price": 89,
     "access": "some"
    },
    {
     "id": "sant-x2",
     "name": "Caldera boat and hot springs",
     "hours": 5,
     "price": 79,
     "access": "some"
    }
   ]
  },
  "mykonos": {
   "id": "mykonos",
   "short": "Mykonos",
   "landing": "tender",
   "blurb": "A Cycladic island with white lanes, windmills and beaches. The ship may dock at the new pier or anchor; the old harbour and Mykonos Town are a short walk or shuttle away.",
   "bestTime": "May to June and September are warm and calmer. July and August are hot, windy and busy.",
   "access": "Town lanes are narrow, cobbled and often crowded. Taxis and buses to beaches are limited; the pier is level.",
   "doThis": [
    "Wander Mykonos Town lanes",
    "See Little Venice and the windmills",
    "Take a boat to Delos",
    "Relax at a beach club"
   ],
   "excursions": [
    {
     "id": "myko-x1",
     "name": "Delos archaeological site",
     "hours": 5,
     "price": 89,
     "access": "some"
    },
    {
     "id": "myko-x2",
     "name": "Mykonos town and beaches",
     "hours": 4,
     "price": 69,
     "access": "some"
    }
   ]
  },
  "kusadasi": {
   "id": "kusadasi",
   "short": "Kusadasi (Ephesus)",
   "landing": "pier",
   "blurb": "A Turkish resort town and the port for Ephesus, one of the best-preserved ancient cities. Ephesus is about 20 minutes by road; the bazaar is beside the pier.",
   "bestTime": "April to June and September to October are warm. July and August are very hot.",
   "access": "Pier is level and the bazaar is a short walk. Ephesus has long marble paths and steps; wear flat shoes.",
   "doThis": [
    "Walk the Ephesus ruins",
    "See the Library of Celsus",
    "Browse the bazaar",
    "Try Turkish tea and delight"
   ],
   "excursions": [
    {
     "id": "kusa-x1",
     "name": "Ephesus ancient city",
     "hours": 5,
     "price": 79,
     "access": "demanding"
    },
    {
     "id": "kusa-x2",
     "name": "Ephesus and House of the Virgin Mary",
     "hours": 6,
     "price": 89,
     "access": "some"
    }
   ]
  },
  "copenhagen": {
   "id": "copenhagen",
   "short": "Copenhagen",
   "landing": "pier",
   "blurb": "A bright, bikeable capital with canals, palaces and the Nyhavn waterfront. The cruise terminal is a short ride from the centre.",
   "bestTime": "May to September is mildest and has long days. Winters are cold and dark.",
   "access": "Terminals are level. Buses and the Metro link to the centre; the old town is flat and cobbled. Watch for bike lanes.",
   "doThis": [
    "Stroll Nyhavn",
    "See the Little Mermaid",
    "Visit Tivoli Gardens",
    "Tour Rosenborg Castle"
   ],
   "excursions": [
    {
     "id": "cope-x1",
     "name": "Copenhagen highlights",
     "hours": 4,
     "price": 79,
     "access": "easy"
    },
    {
     "id": "cope-x2",
     "name": "Canal boat tour",
     "hours": 1,
     "price": 25,
     "access": "easy"
    }
   ]
  },
  "tokyo": {
   "id": "tokyo",
   "short": "Tokyo (Yokohama)",
   "landing": "pier",
   "blurb": "The ship docks at Yokohama, about 30 minutes by train from central Tokyo. Yokohama has a Chinatown, a waterfront and a harbour park; Tokyo is a longer day.",
   "bestTime": "March to May and October to November are mild. Summer is hot and humid; winter is dry and cool.",
   "access": "Terminals are level and well signed. Trains are on time and very crowded at rush hour; stations have lifts but are large.",
   "doThis": [
    "Walk Minato Mirai",
    "Eat in Chinatown",
    "Ride the train to Tokyo",
    "Visit the Cup Noodles Museum"
   ],
   "excursions": [
    {
     "id": "toky-x1",
     "name": "Tokyo highlights by coach",
     "hours": 9,
     "price": 159,
     "access": "some"
    },
    {
     "id": "toky-x2",
     "name": "Kamakura temples day trip",
     "hours": 8,
     "price": 139,
     "access": "some"
    }
   ]
  },
  "hakodate": {
   "id": "hakodate",
   "short": "Hakodate",
   "landing": "pier",
   "blurb": "A harbour city on Hokkaido with a famous night view from Mount Hakodate, a morning fish market and a star-shaped fort. The pier is a short ride from the centre.",
   "bestTime": "June to September is mild. Winters are snowy and cold.",
   "access": "Piers are level. Trams and shuttle buses link to the centre; Mount Hakodate has a ropeway. Hills and cobbles near the old Motomachi area.",
   "doThis": [
    "Ride the Mount Hakodate ropeway",
    "Eat at the morning market",
    "Walk Motomachi",
    "Visit Goryokaku fort"
   ],
   "excursions": [
    {
     "id": "hako-x1",
     "name": "Mount Hakodate and Motomachi",
     "hours": 4,
     "price": 79,
     "access": "some"
    },
    {
     "id": "hako-x2",
     "name": "Goryokaku and the old town",
     "hours": 4,
     "price": 69,
     "access": "some"
    }
   ]
  },
  "singapore": {
   "id": "singapore",
   "short": "Singapore",
   "landing": "pier",
   "blurb": "A clean, orderly island city-state with gardens, hawker centres and a busy harbour. The cruise terminal is on the south coast beside a shopping centre and a Metro station.",
   "bestTime": "February to April is driest; the rest of the year is warm, humid and prone to showers.",
   "access": "Terminals are level with lifts. The Metro is clean, quick and accessible; taxis and ride-hailing are cheap compared with other cities.",
   "doThis": [
    "Visit Gardens by the Bay",
    "Eat at a hawker centre",
    "Walk the Marina Bay waterfront",
    "Browse Chinatown and Little India"
   ],
   "excursions": [
    {
     "id": "sing-x1",
     "name": "Singapore highlights",
     "hours": 5,
     "price": 79,
     "access": "easy"
    },
    {
     "id": "sing-x2",
     "name": "Gardens by the Bay and Marina Bay",
     "hours": 4,
     "price": 69,
     "access": "easy"
    }
   ]
  },
  "sydney": {
   "id": "sydney",
   "short": "Sydney",
   "landing": "pier",
   "blurb": "A harbour city with the Opera House and Harbour Bridge on its doorstep. The ship usually docks at Circular Quay or White Bay; both are a short walk or ferry ride from the sights.",
   "bestTime": "September to November and March to May are mild. December to February is hot; winter is cool and wet.",
   "access": "Circular Quay is level with lifts and accessible ferries and trains. The Rocks area has steep lanes.",
   "doThis": [
    "Tour the Sydney Opera House",
    "Walk the Royal Botanic Garden",
    "Ride a ferry to Manly",
    "Explore The Rocks"
   ],
   "excursions": [
    {
     "id": "sydn-x1",
     "name": "Sydney Harbour cruise",
     "hours": 2,
     "price": 59,
     "access": "easy"
    },
    {
     "id": "sydn-x2",
     "name": "Blue Mountains day trip",
     "hours": 9,
     "price": 129,
     "access": "some"
    }
   ]
  }
 },
 "knowledge": {
  "cozumel": {
   "fairPrices": [
    {
     "route": "Pier to downtown (San Miguel)",
     "car": 8,
     "ceiling": 12
    },
    {
     "route": "Pier to Playa Mia or Paradise Beach",
     "car": 18,
     "ceiling": 25
    },
    {
     "route": "Pier to San Gervasio ruins",
     "car": 40,
     "ceiling": 55
    }
   ],
   "taxiStand": "Official taxis queue at the marked stand outside the pier gate and show a posted rate card. Agree the fare before you get in.",
   "scams": [
    "A person who says the stand is “closed” or “far” and offers a cheaper ride",
    "Tour offers at the gate that need a deposit in cash",
    "A “free” gift or bracelet that turns into a sales talk"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "Quisiera ir a ...",
     "means": "I would like to go to ...",
     "sounds": "kee-SEE-eh-ra eer ah"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "A greeting first, then the question, is polite",
    "Tipping 10 to 15 percent in restaurants is usual",
    "Haggling is normal at market stalls, not in shops with price tags"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Strong sun and heat: drink water and take shade breaks",
    "Swim only where flags say it is safe; currents can be strong on the east coast",
    "Keep valuables in a front pocket in crowded streets"
   ],
   "laws": [
    "Taking coral, shells and sea life from the reef is illegal and fined (verify)",
    "Vaping devices are restricted in Mexico; leave them aboard (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Black coral, shells and sea turtle products",
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "coz-waterfront",
     "name": "Pier to the town square",
     "minutes": 40,
     "step": "Follow the waterfront promenade to the central square.",
     "accessible": "Level paved path with curb cuts. Some uneven tiles near the square.",
     "sit": "Benches along the waterfront and in the square",
     "restroom": "Public restrooms at the square (small fee)"
    }
   ],
   "dayPasses": [
    {
     "id": "coz-mia",
     "name": "Playa Mia Grand Beach Park",
     "price": 59,
     "distance": "15 minutes by taxi",
     "crowd": "busy"
    },
    {
     "id": "coz-sunset",
     "name": "Quiet south shore beach club",
     "price": 35,
     "distance": "20 minutes by taxi",
     "crowd": "quiet"
    }
   ],
   "kids": [
    "Shade: the beach clubs have palapas and shaded pools",
    "Strollers: the waterfront is level; sand is not",
    "Changing: the larger beach clubs have family restrooms",
    "Food: simple plain meals at every beach club"
   ],
   "vendors": [
    {
     "name": "Mercado municipal stalls",
     "what": "Handmade textiles and ceramics"
    },
    {
     "name": "Artisan co-op near the square",
     "what": "Local woodwork and silver"
    }
   ],
   "souvenirs": [
    {
     "item": "Hand-woven bag",
     "fair": "$12 to $25"
    },
    {
     "item": "Small ceramic piece",
     "fair": "$8 to $20"
    }
   ]
  },
  "belize": {
   "fairPrices": [
    {
     "route": "Tourism Village to Belize Zoo",
     "car": 70,
     "ceiling": 90
    },
    {
     "route": "Tourism Village to Altun Ha",
     "car": 85,
     "ceiling": 110
    },
    {
     "route": "Within Belize City (a short ride)",
     "car": 10,
     "ceiling": 15
    }
   ],
   "taxiStand": "Licensed taxis have green plates and wait at the Tourism Village. Agree the fare, and whether it is per person or for the car, before you get in.",
   "scams": [
    "Drivers off the village premises who quote very low and then ask for more",
    "Unsolicited “guides” who insist on leading you",
    "Street changers offering a “better” exchange rate"
   ],
   "phrases": [
    {
     "say": "Good morning",
     "means": "English is the official language",
     "sounds": "as written"
    },
    {
     "say": "Wah gwaan?",
     "means": "How are you? (Belize Kriol)",
     "sounds": "wah GWAHN"
    },
    {
     "say": "Tank yu",
     "means": "Thank you (Kriol)",
     "sounds": "tank YOO"
    },
    {
     "say": "How much fi dat?",
     "means": "How much is that? (Kriol)",
     "sounds": "how much fee DAT"
    }
   ],
   "etiquette": [
    "Belizeans speak English, and a friendly greeting goes a long way",
    "US dollars are widely accepted at 2 Belize dollars to 1 US dollar",
    "Dress modestly away from the beach"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish (widely understood)",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    },
    {
     "allergy": "Nuts",
     "language": "English",
     "text": "I have a serious allergy to tree nuts and peanuts. Please tell me which dishes are safe, including oil and sauces.",
     "english": "Same, in English."
    }
   ],
   "advisories": [
    "Some areas of Belize City are not for walking alone: stay with the village or a licensed guide",
    "Strong sun on the water and the river: cover up and drink water",
    "Cave and jungle tours need closed shoes"
   ],
   "laws": [
    "Reef and wildlife protection is strict; do not take coral, shells or animals (verify)",
    "Check local rules on what you may wear, carry or fly (such as drones) before you go ashore (verify)",
    "Drug possession is illegal and enforced (verify)"
   ],
   "dontBringBack": [
    "Coral, conch shells and turtle products",
    "Fresh produce and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "bze-village",
     "name": "Tourism Village and harbour",
     "minutes": 25,
     "step": "A short loop through the village shops and along the harbour.",
     "accessible": "Level and covered in places; the tender landing has steps.",
     "sit": "Seats in the village cafes",
     "restroom": "Restrooms inside the village"
    }
   ],
   "dayPasses": [
    {
     "id": "bze-cay",
     "name": "Island resort day pass",
     "price": 75,
     "distance": "45 minutes by boat",
     "crowd": "moderate"
    },
    {
     "id": "bze-river",
     "name": "Quiet river lodge lunch and pool",
     "price": 55,
     "distance": "50 minutes by car",
     "crowd": "quiet"
    }
   ],
   "kids": [
    "Shade: the village is partly covered",
    "Strollers: tenders have steps; fold the stroller and keep a hand free",
    "Changing: restrooms are inside the village",
    "Food: simple plates at the village cafes"
   ],
   "vendors": [
    {
     "name": "Tourism Village craft stalls",
     "what": "Carved wood and local chocolate"
    },
    {
     "name": "Garifuna drum makers",
     "what": "Hand-made drums, by a cooperative"
    }
   ],
   "souvenirs": [
    {
     "item": "Local chocolate bar",
     "fair": "$4 to $8"
    },
    {
     "item": "Small hand-carved piece",
     "fair": "$10 to $30"
    }
   ]
  },
  "roatan": {
   "fairPrices": [
    {
     "route": "Pier to West Bay Beach",
     "car": 20,
     "ceiling": 28
    },
    {
     "route": "Pier to the wildlife park",
     "car": 25,
     "ceiling": 35
    },
    {
     "route": "Pier to West End village",
     "car": 22,
     "ceiling": 30
    }
   ],
   "taxiStand": "Official taxis and tour vans wait at the pier gate with a posted rate card. Agree the fare, and the return, before you set off.",
   "scams": [
    "Drivers who ask for the fare “per person” after you arrive",
    "A “shortcut” to a beach that ends at a paid gate",
    "Tour sellers who ask for payment in advance, in cash"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "Quisiera ir a ...",
     "means": "I would like to go to ...",
     "sounds": "kee-SEE-eh-ra eer ah"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "Greet people before asking a question",
    "US dollars are accepted in tourist areas; small bills help",
    "Tip 10 to 15 percent where service is not included"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Strong sun and sudden showers: carry water and a light jacket",
    "Swim where there are other swimmers and a lifeguard or boats nearby",
    "Keep to tourist areas and use official taxis after dark"
   ],
   "laws": [
    "Taking coral, shells and sea life is illegal (verify)",
    "Reef-protecting sunscreen is requested in marine parks (verify)",
    "Drug possession is illegal and enforced (verify)"
   ],
   "dontBringBack": [
    "Coral, shells and turtle products",
    "Fresh fruit, plants and seeds",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "rtb-beach",
     "name": "Pier to the beach and back",
     "minutes": 30,
     "step": "Walk from the pier gate along the shore path to the beach, and return the same way.",
     "accessible": "Mostly level paved path. The last stretch to the water is sand.",
     "sit": "Benches at the pier and beach chairs for rent",
     "restroom": "Restrooms in the pier shops"
    }
   ],
   "dayPasses": [
    {
     "id": "rtb-westbay",
     "name": "West Bay beach club",
     "price": 40,
     "distance": "25 minutes by taxi",
     "crowd": "busy"
    },
    {
     "id": "rtb-quiet",
     "name": "Quiet bay beach and lunch",
     "price": 30,
     "distance": "30 minutes by taxi",
     "crowd": "quiet"
    }
   ],
   "kids": [
    "Shade: the wildlife park is mostly shaded",
    "Strollers: the pier area is level; beach paths are not",
    "Changing: restrooms in the pier shops",
    "Food: plain meals at the pier cafes"
   ],
   "vendors": [
    {
     "name": "Pier artisan market",
     "what": "Hand-painted art and wood carvings"
    },
    {
     "name": "Local coffee roasters",
     "what": "Honduran coffee by the bag"
    }
   ],
   "souvenirs": [
    {
     "item": "Bag of local coffee",
     "fair": "$8 to $14"
    },
    {
     "item": "Hand-painted piece",
     "fair": "$10 to $35"
    }
   ]
  },
  "celebration-key": {
   "fairPrices": [
    {
     "route": "Pier to the island market (if open)",
     "car": 10,
     "ceiling": 15
    }
   ],
   "taxiStand": "Most things are inside the destination, so a taxi is rarely needed. If you leave, use the stand at the pier gate and agree the fare first.",
   "scams": [
    "Offers outside the gate for “cheaper” beach access that turn into a sales pitch",
    "Anyone asking for payment in cash before the ride"
   ],
   "phrases": [],
   "etiquette": [
    "A friendly greeting first is polite",
    "Tipping 15 to 18 percent in restaurants is usual when no service charge is shown"
   ],
   "allergy": [],
   "advisories": [
    "Strong sun and heat: drink water and rest in the shade",
    "Swim where staff are watching and flags allow"
   ],
   "laws": [
    "Camouflage clothing is restricted for adults in The Bahamas (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "cele-w1",
     "name": "Pier to the main beach",
     "minutes": 20,
     "step": "Follow the paved path from the pier to the lagoon and beach.",
     "accessible": "Level, shaded in parts; the sand itself is soft.",
     "sit": "Benches and shaded seating along the path",
     "restroom": "Restrooms at the beach and near the pier"
    }
   ],
   "dayPasses": [
    {
     "id": "cele-p1",
     "name": "Premium lounger and cabana",
     "price": 60,
     "distance": "On site",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Craft market",
     "what": "Straw goods and island crafts"
    },
    {
     "name": "Beachfront stalls",
     "what": "Local snacks and drinks"
    }
   ],
   "souvenirs": [
    {
     "item": "Straw hat",
     "fair": "$15 to $30"
    },
    {
     "item": "Small craft item",
     "fair": "$8 to $20"
    }
   ]
  },
  "grand-turk": {
   "fairPrices": [
    {
     "route": "Pier to Cockburn Town",
     "car": 12,
     "ceiling": 18
    },
    {
     "route": "Pier to Governor’s Beach",
     "car": 10,
     "ceiling": 15
    }
   ],
   "taxiStand": "Taxis wait near the pier exit with posted rates. Agree the fare per person or per car before you set off.",
   "scams": [
    "Unlicensed boat offers on the beach with no life jackets",
    "A guide who “is free today” and later asks for a large tip"
   ],
   "phrases": [],
   "etiquette": [
    "Greet people before asking a question",
    "A 10 to 15 percent tip is usual when no service charge is on the bill"
   ],
   "allergy": [],
   "advisories": [
    "Strong sun: reef-safe sunscreen and a hat",
    "Currents can be strong off the wall; snorkel with a guide or buddy"
   ],
   "laws": [
    "Taking coral, conch and sea life is illegal (verify)",
    "Do not touch or feed the wild donkeys (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "gran-w1",
     "name": "Pier to the lighthouse",
     "minutes": 45,
     "step": "Walk the coast road north to the old lighthouse.",
     "accessible": "Mostly level road; no shade for long stretches.",
     "sit": "Benches at the lighthouse and the beach",
     "restroom": "Restrooms at the pier complex"
    }
   ],
   "dayPasses": [
    {
     "id": "gran-p1",
     "name": "Beach lounger and cabana",
     "price": 35,
     "distance": "Short walk from the pier",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Pier craft stalls",
     "what": "Shell-free crafts and rum cakes"
    },
    {
     "name": "Cockburn Town shops",
     "what": "Local art and sauces"
    }
   ],
   "souvenirs": [
    {
     "item": "Rum cake",
     "fair": "$10 to $18"
    },
    {
     "item": "Hot sauce",
     "fair": "$6 to $12"
    }
   ]
  },
  "san-juan": {
   "lang": "es",
   "fairPrices": [
    {
     "route": "Pier to Old San Juan plaza",
     "car": 8,
     "ceiling": 12
    },
    {
     "route": "Pier to Condado",
     "car": 18,
     "ceiling": 25
    },
    {
     "route": "Pier to the airport",
     "car": 25,
     "ceiling": 32
    }
   ],
   "taxiStand": "Official taxis at the pier have zone rates posted. Ask for the rate card and agree the fare before you go.",
   "scams": [
    "An unmarked car offering a “cheaper” ride",
    "Tour offers that need a deposit in cash"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "US dollars are used and 15 to 20 percent tips are usual in restaurants",
    "A greeting first, then the question, is polite"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "lang": "es",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Heat and sun: drink water and use the shade",
    "Cobbles are slippery after rain; wear flat shoes"
   ],
   "laws": [
    "The US customs rules apply when you return to the mainland (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants (check mainland agricultural rules)",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "san--w1",
     "name": "Pier to El Morro",
     "minutes": 50,
     "step": "Walk up Calle Norzagaray along the wall to the fort lawns.",
     "accessible": "Steep in places; the free trolley covers part of the climb.",
     "sit": "Benches along the esplanade and in the plazas",
     "restroom": "Restrooms at the fort entrance and the plaza"
    }
   ],
   "dayPasses": [
    {
     "id": "san--p1",
     "name": "Condado beach club",
     "price": 40,
     "distance": "15 minutes by taxi",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Plaza artisans",
     "what": "Handmade lace and masks"
    },
    {
     "name": "Calle del Cristo shops",
     "what": "Local rum and coffee"
    }
   ],
   "souvenirs": [
    {
     "item": "Local coffee bag",
     "fair": "$8 to $15"
    },
    {
     "item": "Carnival mask (vejigante)",
     "fair": "$15 to $40"
    }
   ]
  },
  "amber-cove": {
   "lang": "es",
   "fairPrices": [
    {
     "route": "Pier to Puerto Plata centre",
     "car": 30,
     "ceiling": 40
    },
    {
     "route": "Pier to Playa Dorada",
     "car": 35,
     "ceiling": 45
    }
   ],
   "taxiStand": "Taxis queue at the port gate with a rate board. The town is far, so agree the fare and a pick-up time before you go.",
   "scams": [
    "Roadside offers to “show you a better beach” for cash",
    "Unlicensed guides at the gate with no ID badge"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "Greet first, then ask",
    "Tipping 10 percent is usual; a service charge is often included"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "lang": "es",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Strong sun and heat: drink water often",
    "Leave valuables aboard on a market visit"
   ],
   "laws": [
    "Taking coral and sea life is illegal (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "ambe-w1",
     "name": "Pier to the beach and shops",
     "minutes": 15,
     "step": "Follow the paved promenade from the pier to the beach.",
     "accessible": "Level paved path; soft sand at the beach.",
     "sit": "Shaded benches along the promenade",
     "restroom": "Restrooms near the pool and the shops"
    }
   ],
   "dayPasses": [
    {
     "id": "ambe-p1",
     "name": "Beachfront lounger area",
     "price": 30,
     "distance": "Inside the port",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Port craft stalls",
     "what": "Larimar jewellery and woodwork"
    },
    {
     "name": "Café at the pier",
     "what": "Dominican coffee and cacao"
    }
   ],
   "souvenirs": [
    {
     "item": "Cacao bar",
     "fair": "$5 to $10"
    },
    {
     "item": "Small woodcarving",
     "fair": "$8 to $20"
    }
   ]
  },
  "southampton": {
   "fairPrices": [
    {
     "route": "Terminal to Southampton Central",
     "car": 9,
     "ceiling": 13
    },
    {
     "route": "Terminal to the airport",
     "car": 22,
     "ceiling": 30
    }
   ],
   "taxiStand": "Licensed black or marked taxis wait at the terminal rank. Ask for the meter, or agree the fare for airport runs.",
   "scams": [
    "Unlicensed minicabs touting for fares at the terminal",
    "Ticket sellers offering “discounted” rail tickets in the street"
   ],
   "phrases": [],
   "etiquette": [
    "Queue in turn and say “please” and “thank you”",
    "Tipping 10 to 12.5 percent is usual when no service charge is shown"
   ],
   "allergy": [],
   "advisories": [
    "Weather changes quickly; carry a light rain jacket",
    "Pavements can be wet and slippery"
   ],
   "laws": [
    "Pounds sterling are used; cards are widely taken (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "sout-w1",
     "name": "Terminal to the Old Town walls",
     "minutes": 35,
     "step": "Walk along the waterfront to Bargate and the medieval walls.",
     "accessible": "Level paved route; a few cobbled stretches in the Old Town.",
     "sit": "Benches along the quay and at Bargate",
     "restroom": "Restrooms at Bargate Shopping Centre and the quay"
    }
   ],
   "dayPasses": [
    {
     "id": "sout-p1",
     "name": "Day rail ticket to Winchester",
     "price": 22,
     "distance": "30 minutes by train",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Oxford Street cafés",
     "what": "Pies, pastries and tea"
    },
    {
     "name": "Winchester market",
     "what": "Local cheese and chutneys"
    }
   ],
   "souvenirs": [
    {
     "item": "Tea tin",
     "fair": "£6 to £12"
    },
    {
     "item": "Local biscuits",
     "fair": "£4 to £8"
    }
   ]
  },
  "barcelona": {
   "lang": "es",
   "fairPrices": [
    {
     "route": "Terminal to La Rambla",
     "car": 15,
     "ceiling": 20
    },
    {
     "route": "Terminal to Sagrada Família",
     "car": 20,
     "ceiling": 28
    },
    {
     "route": "Terminal to the airport",
     "car": 35,
     "ceiling": 45
    }
   ],
   "taxiStand": "Black-and-yellow taxis wait at the terminal rank and run the meter. Ask for the meter before you set off.",
   "scams": [
    "Pickpockets on La Rambla and the Metro, often working in pairs",
    "A “friendly” stranger who drops something or spills on you"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "Lunch is late and dinner later; many shops close mid-afternoon",
    "Tipping is modest: a few euros or rounding up"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "lang": "es",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Keep bags zipped and in front on busy streets",
    "Crowds at major sites: book timed entry ahead"
   ],
   "laws": [
    "Walking in swimwear away from the beach can be fined (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods (fines apply in Spain, verify)",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "barc-w1",
     "name": "Terminal to the Gothic Quarter",
     "minutes": 50,
     "step": "Follow the waterfront to Columbus Monument and up La Rambla.",
     "accessible": "Level to La Rambla, then cobbled and narrow streets.",
     "sit": "Benches on La Rambla and in Plaça Reial",
     "restroom": "Cafés and the Boqueria market have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "barc-p1",
     "name": "Day pass for Metro and buses",
     "price": 12,
     "distance": "Across the city",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "La Boqueria market",
     "what": "Cured ham, cheese and fruit"
    },
    {
     "name": "Gothic Quarter shops",
     "what": "Ceramics and leatherwork"
    }
   ],
   "souvenirs": [
    {
     "item": "Ceramic tile",
     "fair": "€8 to €20"
    },
    {
     "item": "Olive oil",
     "fair": "€6 to €12"
    }
   ]
  },
  "palma": {
   "lang": "es",
   "fairPrices": [
    {
     "route": "Pier to the cathedral",
     "car": 12,
     "ceiling": 16
    },
    {
     "route": "Pier to Illetes beach",
     "car": 22,
     "ceiling": 30
    }
   ],
   "taxiStand": "White taxis wait at the pier rank and use a meter. Ask for the meter before you set off.",
   "scams": [
    "Unlicensed drivers offering a fixed price much above the meter",
    "Pickpockets in crowded markets"
   ],
   "phrases": [
    {
     "say": "Hola, buenos días",
     "means": "Hello, good morning",
     "sounds": "OH-la, BWEH-nos DEE-as"
    },
    {
     "say": "Gracias",
     "means": "Thank you",
     "sounds": "GRAH-see-as"
    },
    {
     "say": "¿Cuánto cuesta?",
     "means": "How much is it?",
     "sounds": "KWAN-toh KWEH-sta"
    },
    {
     "say": "¿Dónde está el baño?",
     "means": "Where is the restroom?",
     "sounds": "DON-deh eh-STAH el BAN-yo"
    },
    {
     "say": "Necesito ayuda",
     "means": "I need help",
     "sounds": "neh-seh-SEE-toh ah-YOO-da"
    }
   ],
   "etiquette": [
    "Greet shopkeepers on entering",
    "Tipping is modest: round up or leave a few euros"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Spanish",
     "lang": "es",
     "text": "Tengo alergia grave a los frutos secos y al cacahuate. No puedo comer nada que los contenga, ni aceite o trazas. ¿Puede decirme qué platos son seguros?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Strong sun: hat and water in summer",
    "Cobbles can be slippery when wet"
   ],
   "laws": [
    "Walking in swimwear away from the beach can be fined (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "palm-w1",
     "name": "Pier to La Seu cathedral",
     "minutes": 40,
     "step": "Follow the seafront promenade to the cathedral and Parc de la Mar.",
     "accessible": "Level promenade; slopes and cobbles in the old town.",
     "sit": "Benches along the promenade and in the park",
     "restroom": "Cafés and the cathedral visitor area have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "palm-p1",
     "name": "Beach club near the city",
     "price": 40,
     "distance": "15 minutes by taxi",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Mercat de l’Olivar",
     "what": "Local cheese, olives and sobrassada"
    },
    {
     "name": "Old town shops",
     "what": "Leather goods and ceramics"
    }
   ],
   "souvenirs": [
    {
     "item": "Local olive oil",
     "fair": "€6 to €12"
    },
    {
     "item": "Hand-painted ceramic",
     "fair": "€8 to €25"
    }
   ]
  },
  "marseille": {
   "lang": "fr",
   "fairPrices": [
    {
     "route": "Terminal to the Old Port",
     "car": 15,
     "ceiling": 22
    },
    {
     "route": "Terminal to Notre-Dame de la Garde",
     "car": 20,
     "ceiling": 28
    }
   ],
   "taxiStand": "Official taxis queue at the terminal; ask for the meter, as the standard fare rises at night and on Sundays.",
   "scams": [
    "A “petition” or bracelet pushed on you for money",
    "Pickpockets around the Old Port and station"
   ],
   "phrases": [
    {
     "say": "Bonjour",
     "means": "Hello, good day",
     "sounds": "bon-ZHOOR"
    },
    {
     "say": "Merci",
     "means": "Thank you",
     "sounds": "mehr-SEE"
    },
    {
     "say": "C’est combien ?",
     "means": "How much is it?",
     "sounds": "say kom-BYAN"
    },
    {
     "say": "Où sont les toilettes ?",
     "means": "Where is the restroom?",
     "sounds": "oo son lay twa-LET"
    },
    {
     "say": "J’ai besoin d’aide",
     "means": "I need help",
     "sounds": "zhay buh-ZWAN ded"
    }
   ],
   "etiquette": [
    "Say “Bonjour” when you enter a shop",
    "A service charge is included, so tipping is small"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "French",
     "lang": "fr",
     "text": "J’ai une allergie grave aux fruits à coque et aux arachides. Je ne peux rien manger qui en contienne, ni huile ni traces. Pouvez-vous me dire quels plats sont sûrs ?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Keep bags zipped in crowded areas",
    "Strong sun: carry water in summer"
   ],
   "laws": [
    "Carry ID or a copy, not the original passport (verify)",
    "Counterfeit goods can bring fines at customs (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "mars-w1",
     "name": "Old Port loop",
     "minutes": 35,
     "step": "Walk the quay from the fish market to the Fort Saint-Jean.",
     "accessible": "Level paved quay with some cobbled stretches.",
     "sit": "Benches and cafés along the quay",
     "restroom": "Restrooms at the Vieux-Port and cafés"
    }
   ],
   "dayPasses": [
    {
     "id": "mars-p1",
     "name": "Calanques boat day ticket",
     "price": 35,
     "distance": "From the Old Port",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Savon de Marseille shops",
     "what": "Traditional olive-oil soap"
    },
    {
     "name": "Old Port fish market",
     "what": "Fresh fish and local snacks"
    }
   ],
   "souvenirs": [
    {
     "item": "Marseille soap",
     "fair": "€4 to €10"
    },
    {
     "item": "Navettes (biscuits)",
     "fair": "€5 to €9"
    }
   ]
  },
  "genoa": {
   "lang": "it",
   "fairPrices": [
    {
     "route": "Terminal to the old town",
     "car": 10,
     "ceiling": 15
    },
    {
     "route": "Terminal to the main station (Brignole)",
     "car": 16,
     "ceiling": 22
    }
   ],
   "taxiStand": "Official white taxis wait at the terminal; insist on the meter. Radio taxis can be booked at the desk.",
   "scams": [
    "A street “helper” at ticket machines who asks for cash",
    "Pickpockets in tight alleys"
   ],
   "phrases": [
    {
     "say": "Buongiorno",
     "means": "Hello, good day",
     "sounds": "bwon-JOR-no"
    },
    {
     "say": "Grazie",
     "means": "Thank you",
     "sounds": "GRAHT-see-eh"
    },
    {
     "say": "Quanto costa?",
     "means": "How much is it?",
     "sounds": "KWAN-to KO-sta"
    },
    {
     "say": "Dov’è il bagno?",
     "means": "Where is the restroom?",
     "sounds": "do-VEH eel BAN-yo"
    },
    {
     "say": "Ho bisogno di aiuto",
     "means": "I need help",
     "sounds": "o bee-ZON-yo dee ah-YOO-to"
    }
   ],
   "etiquette": [
    "Greet with “Buongiorno”",
    "A cover charge (coperto) is usual; extra tips are small"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Italian",
     "lang": "it",
     "text": "Ho una grave allergia alla frutta a guscio e alle arachidi. Non posso mangiare nulla che le contenga, nemmeno olio o tracce. Può dirmi quali piatti sono sicuri?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Alleys can feel dim in the evening; keep to busier streets",
    "Cobbles are slippery after rain"
   ],
   "laws": [
    "Carry ID or a copy, not the original passport (verify)",
    "Taking antiquities and protected items is illegal (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods (fines apply in Italy, verify)",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "geno-w1",
     "name": "Terminal to Piazza De Ferrari",
     "minutes": 35,
     "step": "Follow Via Gramsci into the old town to the fountain square.",
     "accessible": "Mostly level; narrow cobbled alleys near the cathedral.",
     "sit": "Benches at the aquarium and Piazza De Ferrari",
     "restroom": "Restrooms at the aquarium and cafés"
    }
   ],
   "dayPasses": [
    {
     "id": "geno-p1",
     "name": "Aquarium day ticket",
     "price": 30,
     "distance": "Beside the terminals",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Via Garibaldi shops",
     "what": "Pesto, focaccia and olive oil"
    },
    {
     "name": "Mercato Orientale",
     "what": "Fresh produce and cheese"
    }
   ],
   "souvenirs": [
    {
     "item": "Pesto jar",
     "fair": "€5 to €10"
    },
    {
     "item": "Olive oil",
     "fair": "€7 to €14"
    }
   ]
  },
  "la-spezia": {
   "lang": "it",
   "fairPrices": [
    {
     "route": "Terminal to La Spezia station",
     "car": 8,
     "ceiling": 12
    },
    {
     "route": "Terminal to Portovenere",
     "car": 32,
     "ceiling": 42
    }
   ],
   "taxiStand": "Official white taxis wait at the terminal. For villages, use the train; taxis cannot drive into most of them.",
   "scams": [
    "Tickets sold on the street at inflated prices",
    "Pickpockets on the crowded trains"
   ],
   "phrases": [
    {
     "say": "Buongiorno",
     "means": "Hello, good day",
     "sounds": "bwon-JOR-no"
    },
    {
     "say": "Grazie",
     "means": "Thank you",
     "sounds": "GRAHT-see-eh"
    },
    {
     "say": "Quanto costa?",
     "means": "How much is it?",
     "sounds": "KWAN-to KO-sta"
    },
    {
     "say": "Dov’è il bagno?",
     "means": "Where is the restroom?",
     "sounds": "do-VEH eel BAN-yo"
    },
    {
     "say": "Ho bisogno di aiuto",
     "means": "I need help",
     "sounds": "o bee-ZON-yo dee ah-YOO-to"
    }
   ],
   "etiquette": [
    "Greet with “Buongiorno”",
    "A cover charge (coperto) is usual; extra tips are small"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Italian",
     "lang": "it",
     "text": "Ho una grave allergia alla frutta a guscio e alle arachidi. Non posso mangiare nulla che le contenga, nemmeno olio o tracce. Può dirmi quali piatti sono sicuri?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Trails can be closed after rain; check before you go",
    "Book the return train or ferry in good time for all-aboard"
   ],
   "laws": [
    "Carry ID or a copy, not the original passport (verify)",
    "Stay on marked paths; some are ticketed (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "la-s-w1",
     "name": "Terminal to the promenade",
     "minutes": 20,
     "step": "Walk Via Prione to the seafront promenade and marina.",
     "accessible": "Level paved streets throughout.",
     "sit": "Benches along the promenade",
     "restroom": "Restrooms at the station and in cafés"
    }
   ],
   "dayPasses": [
    {
     "id": "la-s-p1",
     "name": "Cinque Terre train card",
     "price": 17,
     "distance": "10 to 20 minutes by train",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "La Spezia market",
     "what": "Local produce, anchovies and cheese"
    },
    {
     "name": "Portovenere shops",
     "what": "Linen and lemon goods"
    }
   ],
   "souvenirs": [
    {
     "item": "Lemon liqueur",
     "fair": "€10 to €18"
    },
    {
     "item": "Linen towel",
     "fair": "€10 to €25"
    }
   ]
  },
  "civitavecchia": {
   "lang": "it",
   "fairPrices": [
    {
     "route": "Port to Civitavecchia station",
     "car": 10,
     "ceiling": 14
    },
    {
     "route": "Port to Rome (fixed fare)",
     "car": 130,
     "ceiling": 160
    }
   ],
   "taxiStand": "Taxis have a fixed fare to Rome posted at the rank. Confirm the fare and return time before you go; a train is cheaper.",
   "scams": [
    "Rome “guides” offering skip-the-line for cash",
    "Costumed “gladiators” who demand money for photos"
   ],
   "phrases": [
    {
     "say": "Buongiorno",
     "means": "Hello, good day",
     "sounds": "bwon-JOR-no"
    },
    {
     "say": "Grazie",
     "means": "Thank you",
     "sounds": "GRAHT-see-eh"
    },
    {
     "say": "Quanto costa?",
     "means": "How much is it?",
     "sounds": "KWAN-to KO-sta"
    },
    {
     "say": "Dov’è il bagno?",
     "means": "Where is the restroom?",
     "sounds": "do-VEH eel BAN-yo"
    },
    {
     "say": "Ho bisogno di aiuto",
     "means": "I need help",
     "sounds": "o bee-ZON-yo dee ah-YOO-to"
    }
   ],
   "etiquette": [
    "Greet with “Buongiorno”",
    "A cover charge (coperto) is usual; extra tips are small"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Italian",
     "lang": "it",
     "text": "Ho una grave allergia alla frutta a guscio e alle arachidi. Non posso mangiare nulla che le contenga, nemmeno olio o tracce. Può dirmi quali piatti sono sicuri?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Allow at least 3 hours for the return to the ship",
    "Cover shoulders and knees to enter churches"
   ],
   "laws": [
    "Sitting on monument steps can be fined (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Antiquities and stones from ruins",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "civi-w1",
     "name": "Port to the Civitavecchia fort",
     "minutes": 20,
     "step": "Walk along the harbour to Michelangelo’s fort.",
     "accessible": "Level paved harbour road.",
     "sit": "Benches along the harbour",
     "restroom": "Cafés near the harbour have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "civi-p1",
     "name": "Return train to Rome",
     "price": 10,
     "distance": "About 1 hour each way",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Rome street markets",
     "what": "Leather goods and prints"
    },
    {
     "name": "Civitavecchia cafés",
     "what": "Coffee and pastries"
    }
   ],
   "souvenirs": [
    {
     "item": "Local olive oil",
     "fair": "€7 to €14"
    },
    {
     "item": "Small ceramic piece",
     "fair": "€8 to €20"
    }
   ]
  },
  "naples": {
   "lang": "it",
   "fairPrices": [
    {
     "route": "Terminal to Piazza Garibaldi station",
     "car": 12,
     "ceiling": 17
    },
    {
     "route": "Terminal to the Archaeological Museum",
     "car": 14,
     "ceiling": 20
    },
    {
     "route": "Terminal to Pompeii",
     "car": 65,
     "ceiling": 80
    }
   ],
   "taxiStand": "Official taxis show fixed fares from the port to major sights on a posted card. Ask for the card and agree the fare.",
   "scams": [
    "Pickpockets and motorbike snatchers on busy streets",
    "Unmarked taxis quoting a high flat price"
   ],
   "phrases": [
    {
     "say": "Buongiorno",
     "means": "Hello, good day",
     "sounds": "bwon-JOR-no"
    },
    {
     "say": "Grazie",
     "means": "Thank you",
     "sounds": "GRAHT-see-eh"
    },
    {
     "say": "Quanto costa?",
     "means": "How much is it?",
     "sounds": "KWAN-to KO-sta"
    },
    {
     "say": "Dov’è il bagno?",
     "means": "Where is the restroom?",
     "sounds": "do-VEH eel BAN-yo"
    },
    {
     "say": "Ho bisogno di aiuto",
     "means": "I need help",
     "sounds": "o bee-ZON-yo dee ah-YOO-to"
    }
   ],
   "etiquette": [
    "Greet with “Buongiorno”",
    "A cover charge (coperto) is usual; extra tips are small"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Italian",
     "lang": "it",
     "text": "Ho una grave allergia alla frutta a guscio e alle arachidi. Non posso mangiare nulla che le contenga, nemmeno olio o tracce. Può dirmi quali piatti sono sicuri?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Keep bags on the side away from traffic",
    "Cross roads with care; traffic is dense"
   ],
   "laws": [
    "Carry ID or a copy, not the original passport (verify)",
    "Taking stones or finds from ruins is illegal (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Stones and antiquities from Pompeii",
    "Counterfeit goods (fines apply in Italy, verify)"
   ],
   "walks": [
    {
     "id": "napl-w1",
     "name": "Terminal to Piazza del Plebiscito",
     "minutes": 25,
     "step": "Walk Via Acton past the Maschio Angioino castle to the grand square.",
     "accessible": "Mostly level; some cobbles.",
     "sit": "Benches at the castle and the square",
     "restroom": "Cafés on the square have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "napl-p1",
     "name": "Pompeii entry ticket",
     "price": 20,
     "distance": "40 minutes by train",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Via San Gregorio Armeno",
     "what": "Nativity figures and crafts"
    },
    {
     "name": "Spaccanapoli shops",
     "what": "Coffee, sweets and pastries"
    }
   ],
   "souvenirs": [
    {
     "item": "Limoncello",
     "fair": "€8 to €16"
    },
    {
     "item": "Nativity figure",
     "fair": "€10 to €40"
    }
   ]
  },
  "athens": {
   "lang": "el",
   "fairPrices": [
    {
     "route": "Port to Acropolis",
     "car": 30,
     "ceiling": 40
    },
    {
     "route": "Port to Plaka",
     "car": 28,
     "ceiling": 38
    },
    {
     "route": "Port to the airport",
     "car": 50,
     "ceiling": 65
    }
   ],
   "taxiStand": "Official yellow taxis wait at the terminal; ask for the meter. Prices are higher at night and with luggage.",
   "scams": [
    "A “friendly local” who invites you to a bar, then presents a huge bill",
    "Meters “not working”"
   ],
   "phrases": [
    {
     "say": "Καλημέρα",
     "means": "Good morning",
     "sounds": "ka-lee-ME-ra"
    },
    {
     "say": "Ευχαριστώ",
     "means": "Thank you",
     "sounds": "ef-ha-ree-STO"
    },
    {
     "say": "Πόσο κάνει;",
     "means": "How much is it?",
     "sounds": "PO-so KA-nee"
    },
    {
     "say": "Πού είναι η τουαλέτα;",
     "means": "Where is the restroom?",
     "sounds": "poo EE-neh ee too-a-LE-ta"
    },
    {
     "say": "Χρειάζομαι βοήθεια",
     "means": "I need help",
     "sounds": "hree-A-zo-meh vo-EE-thee-a"
    }
   ],
   "etiquette": [
    "Greetings first, then the question",
    "Tipping: round up or 5 to 10 percent"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Greek",
     "lang": "el",
     "text": "Έχω σοβαρή αλλεργία στους ξηρούς καρπούς και στα φιστίκια. Δεν μπορώ να φάω τίποτα που τα περιέχει, ούτε λάδι ή ίχνη. Μπορείτε να μου πείτε ποια πιάτα είναι ασφαλή;",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Heat on the Acropolis: go early, carry water, wear good shoes",
    "Marble is slippery, even when dry"
   ],
   "laws": [
    "Taking antiquities or stones from sites is illegal (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Antiquities and stones from ruins",
    "Fresh fruit, meat and plants",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "athe-w1",
     "name": "Syntagma to the Plaka",
     "minutes": 20,
     "step": "Walk from the square along Ermou, then through the Plaka lanes.",
     "accessible": "Mostly level; some steps and cobbles in the Plaka.",
     "sit": "Benches in the National Garden and Plaka squares",
     "restroom": "Cafés and the Acropolis Museum have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "athe-p1",
     "name": "Metro day ticket",
     "price": 5,
     "distance": "Piraeus to the centre",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Monastiraki flea market",
     "what": "Leather sandals and linen"
    },
    {
     "name": "Plaka shops",
     "what": "Olive oil, honey and herbs"
    }
   ],
   "souvenirs": [
    {
     "item": "Olive oil soap",
     "fair": "€3 to €8"
    },
    {
     "item": "Greek honey",
     "fair": "€6 to €12"
    }
   ]
  },
  "santorini": {
   "lang": "el",
   "fairPrices": [
    {
     "route": "Old port to Fira (cable car)",
     "car": 8,
     "ceiling": 10
    },
    {
     "route": "Fira to Oia (bus)",
     "car": 3,
     "ceiling": 5
    },
    {
     "route": "Taxi from Fira to Oia",
     "car": 35,
     "ceiling": 50
    }
   ],
   "taxiStand": "Taxis are few and in demand; join the queue at the stand and agree the fare first. The bus from Fira to Oia is cheaper but crowded.",
   "scams": [
    "Donkey rides priced per person with no fare card",
    "Unofficial boat offers back to the ship"
   ],
   "phrases": [
    {
     "say": "Καλημέρα",
     "means": "Good morning",
     "sounds": "ka-lee-ME-ra"
    },
    {
     "say": "Ευχαριστώ",
     "means": "Thank you",
     "sounds": "ef-ha-ree-STO"
    },
    {
     "say": "Πόσο κάνει;",
     "means": "How much is it?",
     "sounds": "PO-so KA-nee"
    },
    {
     "say": "Πού είναι η τουαλέτα;",
     "means": "Where is the restroom?",
     "sounds": "poo EE-neh ee too-a-LE-ta"
    },
    {
     "say": "Χρειάζομαι βοήθεια",
     "means": "I need help",
     "sounds": "hree-A-zo-meh vo-EE-thee-a"
    }
   ],
   "etiquette": [
    "Be kind to the donkeys; do not ride if you are heavy",
    "Tipping: round up or 5 to 10 percent"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Greek",
     "lang": "el",
     "text": "Έχω σοβαρή αλλεργία στους ξηρούς καρπούς και στα φιστίκια. Δεν μπορώ να φάω τίποτα που τα περιέχει, ούτε λάδι ή ίχνη. Μπορείτε να μου πείτε ποια πιάτα είναι ασφαλή;",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Wind and swell can delay tenders; follow ship announcements",
    "Steps are steep and slippery; take the cable car if you tire"
   ],
   "laws": [
    "Do not ride donkeys if the weight limit would be exceeded (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "sant-w1",
     "name": "Fira to Firostefani",
     "minutes": 25,
     "step": "Follow the caldera path north from Fira to Firostefani.",
     "accessible": "Paved but stepped in places; no shade.",
     "sit": "Benches along the path and at cafés",
     "restroom": "Cafés on the path have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "sant-p1",
     "name": "Black-sand beach club (Kamari)",
     "price": 30,
     "distance": "25 minutes by taxi",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Fira jewellery shops",
     "what": "Gold and silver pieces"
    },
    {
     "name": "Winery tasting rooms",
     "what": "Assyrtiko and Vinsanto wine"
    }
   ],
   "souvenirs": [
    {
     "item": "Vinsanto wine",
     "fair": "€15 to €30"
    },
    {
     "item": "Fava or capers jar",
     "fair": "€5 to €10"
    }
   ]
  },
  "mykonos": {
   "lang": "el",
   "fairPrices": [
    {
     "route": "Pier to Mykonos Town",
     "car": 15,
     "ceiling": 22
    },
    {
     "route": "Pier to Paradise Beach",
     "car": 32,
     "ceiling": 42
    }
   ],
   "taxiStand": "Taxis are few and in demand. Use the main queue and agree the fare; buses to the beaches run from the town bus stop.",
   "scams": [
    "Boat taxis quoting very high fares in the harbour",
    "Beach clubs that add an unmentioned minimum spend"
   ],
   "phrases": [
    {
     "say": "Καλημέρα",
     "means": "Good morning",
     "sounds": "ka-lee-ME-ra"
    },
    {
     "say": "Ευχαριστώ",
     "means": "Thank you",
     "sounds": "ef-ha-ree-STO"
    },
    {
     "say": "Πόσο κάνει;",
     "means": "How much is it?",
     "sounds": "PO-so KA-nee"
    },
    {
     "say": "Πού είναι η τουαλέτα;",
     "means": "Where is the restroom?",
     "sounds": "poo EE-neh ee too-a-LE-ta"
    },
    {
     "say": "Χρειάζομαι βοήθεια",
     "means": "I need help",
     "sounds": "hree-A-zo-meh vo-EE-thee-a"
    }
   ],
   "etiquette": [
    "Greetings first, then the question",
    "Tipping: round up or 5 to 10 percent"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Greek",
     "lang": "el",
     "text": "Έχω σοβαρή αλλεργία στους ξηρούς καρπούς και στα φιστίκια. Δεν μπορώ να φάω τίποτα που τα περιέχει, ούτε λάδι ή ίχνη. Μπορείτε να μου πείτε ποια πιάτα είναι ασφαλή;",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Wind can make the sea rough; follow ship announcements",
    "Cobbles are slippery; wear flat shoes"
   ],
   "laws": [
    "Taking stones or finds from Delos is illegal (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "myko-w1",
     "name": "Old port to Little Venice",
     "minutes": 20,
     "step": "Follow the waterfront to the windmills and Little Venice.",
     "accessible": "Level waterfront, then cobbled lanes.",
     "sit": "Benches along the waterfront and windmills",
     "restroom": "Cafés on the front have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "myko-p1",
     "name": "Beach club lounger",
     "price": 50,
     "distance": "20 minutes by taxi",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Town boutiques",
     "what": "Linen and jewellery"
    },
    {
     "name": "Harbour tavernas",
     "what": "Fresh fish and meze"
    }
   ],
   "souvenirs": [
    {
     "item": "Local ceramic",
     "fair": "€10 to €30"
    },
    {
     "item": "Olive oil soap",
     "fair": "€3 to €8"
    }
   ]
  },
  "kusadasi": {
   "lang": "tr",
   "fairPrices": [
    {
     "route": "Pier to Ephesus",
     "car": 35,
     "ceiling": 45
    },
    {
     "route": "Pier to Selçuk",
     "car": 25,
     "ceiling": 32
    }
   ],
   "taxiStand": "Taxis wait outside the pier gate with a posted list of fares. Agree the fare and a return time, and ask if the price is per car.",
   "scams": [
    "Shopkeepers who offer tea, then press hard to buy",
    "Taxi drivers who quote in euros at a high rate"
   ],
   "phrases": [
    {
     "say": "Merhaba",
     "means": "Hello",
     "sounds": "MEHR-ha-ba"
    },
    {
     "say": "Teşekkür ederim",
     "means": "Thank you",
     "sounds": "teh-shek-KOOR eh-deh-reem"
    },
    {
     "say": "Bu ne kadar?",
     "means": "How much is it?",
     "sounds": "boo neh ka-DAR"
    },
    {
     "say": "Tuvalet nerede?",
     "means": "Where is the restroom?",
     "sounds": "too-va-LET neh-reh-DEH"
    },
    {
     "say": "Yardıma ihtiyacım var",
     "means": "I need help",
     "sounds": "yar-duh-MA ih-tee-ya-JUM var"
    }
   ],
   "etiquette": [
    "Bargaining is expected in the bazaar",
    "Tipping 10 percent is usual in restaurants"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Turkish",
     "lang": "tr",
     "text": "Sert kabuklu yemişlere ve yer fıstığına ciddi alerjim var. Bunları içeren, yağı ya da izi bulunan hiçbir şey yiyemem. Hangi yemeklerin güvenli olduğunu söyleyebilir misiniz?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Heat at Ephesus: shade is scarce, bring water and a hat",
    "Marble is slippery"
   ],
   "laws": [
    "Taking antiquities or stones from sites is a serious offence (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Antiquities and stones from ruins",
    "Fresh fruit, meat and plants",
    "Counterfeit goods (fines apply, verify)"
   ],
   "walks": [
    {
     "id": "kusa-w1",
     "name": "Pier to the bazaar",
     "minutes": 15,
     "step": "Walk through the harbour gate to the covered bazaar lanes.",
     "accessible": "Level paved lanes.",
     "sit": "Tea gardens along the lanes",
     "restroom": "Cafés and the pier terminal have restrooms"
    }
   ],
   "dayPasses": [
    {
     "id": "kusa-p1",
     "name": "Ephesus entry ticket",
     "price": 30,
     "distance": "20 minutes by road",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Bazaar stalls",
     "what": "Leather goods, carpets and lamps"
    },
    {
     "name": "Spice and sweets shops",
     "what": "Turkish delight and tea"
    }
   ],
   "souvenirs": [
    {
     "item": "Turkish delight",
     "fair": "$6 to $12"
    },
    {
     "item": "Ceramic bowl",
     "fair": "$8 to $25"
    }
   ]
  },
  "copenhagen": {
   "lang": "da",
   "fairPrices": [
    {
     "route": "Terminal to Nyhavn",
     "car": 16,
     "ceiling": 22
    },
    {
     "route": "Terminal to Tivoli Gardens",
     "car": 20,
     "ceiling": 28
    }
   ],
   "taxiStand": "Taxis are metered and expensive. Official taxis show a sign and light; check that the meter is on.",
   "scams": [
    "Unlicensed taxis without a meter",
    "Pickpockets at Nyhavn and Tivoli in the summer"
   ],
   "phrases": [
    {
     "say": "Goddag",
     "means": "Hello, good day",
     "sounds": "go-DAY"
    },
    {
     "say": "Tak",
     "means": "Thank you",
     "sounds": "tahk"
    },
    {
     "say": "Hvad koster det?",
     "means": "How much is it?",
     "sounds": "vahd KO-ster deh"
    },
    {
     "say": "Hvor er toilettet?",
     "means": "Where is the restroom?",
     "sounds": "vor air toy-LET-eh"
    },
    {
     "say": "Jeg har brug for hjælp",
     "means": "I need help",
     "sounds": "yai har broo for yelp"
    }
   ],
   "etiquette": [
    "Service is included, so tips are not expected",
    "Stay out of bike lanes"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Danish",
     "lang": "da",
     "text": "Jeg har en alvorlig allergi over for nødder og jordnødder. Jeg kan ikke spise noget, der indeholder dem, heller ikke olie eller spor. Kan I fortælle mig, hvilke retter der er sikre?",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Bikes are fast and silent; look both ways before crossing lanes",
    "Weather changes quickly; carry a light jacket"
   ],
   "laws": [
    "Cyclists have right of way in bike lanes (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit bags, watches and brand goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "cope-w1",
     "name": "Nyhavn to the Little Mermaid",
     "minutes": 50,
     "step": "Follow the waterfront promenade north past Amalienborg to the statue.",
     "accessible": "Level paved path.",
     "sit": "Benches along the promenade",
     "restroom": "Restrooms at Nyhavn and the Kastellet park"
    }
   ],
   "dayPasses": [
    {
     "id": "cope-p1",
     "name": "Copenhagen Card (24 hours)",
     "price": 60,
     "distance": "City-wide",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Strøget shops",
     "what": "Danish design and knitwear"
    },
    {
     "name": "Torvehallerne market",
     "what": "Smørrebrød and pastries"
    }
   ],
   "souvenirs": [
    {
     "item": "Danish pastry",
     "fair": "DKK 25 to 50"
    },
    {
     "item": "Wooden toy",
     "fair": "DKK 100 to 250"
    }
   ]
  },
  "tokyo": {
   "lang": "ja",
   "fairPrices": [
    {
     "route": "Terminal to Yokohama Station",
     "car": 25,
     "ceiling": 32
    },
    {
     "route": "Terminal to Chinatown",
     "car": 18,
     "ceiling": 25
    }
   ],
   "taxiStand": "Taxis are clean, metered and honest. The rear door opens by itself; do not touch it. Tipping is not expected.",
   "scams": [
    "Touts in nightlife districts who pull guests into bars",
    "Unsolicited approaches to “change money”"
   ],
   "phrases": [
    {
     "say": "こんにちは (Konnichiwa)",
     "means": "Hello, good day",
     "sounds": "kon-nee-chee-wah"
    },
    {
     "say": "ありがとう (Arigatō)",
     "means": "Thank you",
     "sounds": "ah-ree-gah-toh"
    },
    {
     "say": "いくらですか (Ikura desu ka)",
     "means": "How much is it?",
     "sounds": "ee-koo-rah dess kah"
    },
    {
     "say": "トイレはどこですか (Toire wa doko desu ka)",
     "means": "Where is the restroom?",
     "sounds": "toy-reh wah doh-koh dess kah"
    },
    {
     "say": "助けてください (Tasukete kudasai)",
     "means": "Please help me",
     "sounds": "tah-soo-keh-teh koo-dah-sigh"
    }
   ],
   "etiquette": [
    "Remove shoes where asked; carry a small cloth for wet hands",
    "Do not tip; it can cause confusion"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Japanese",
     "lang": "ja",
     "text": "私はナッツ類とピーナッツに重いアレルギーがあります。それらを含むもの、油や微量も食べられません。安全な料理を教えていただけますか？",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "Trains are very crowded at 7 to 9 am and 5 to 7 pm",
    "Carry some cash; many small places do not take cards"
   ],
   "laws": [
    "Some common medicines are restricted in Japan (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "toky-w1",
     "name": "Terminal to Chinatown",
     "minutes": 30,
     "step": "Walk the Yamashita waterfront path to the Chinatown gates.",
     "accessible": "Level paved path.",
     "sit": "Benches along the waterfront",
     "restroom": "Restrooms in Yamashita Park and Chinatown"
    }
   ],
   "dayPasses": [
    {
     "id": "toky-p1",
     "name": "Suica or Pasmo day travel (top-up)",
     "price": 20,
     "distance": "City trains",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Chinatown stalls",
     "what": "Steamed buns and snacks"
    },
    {
     "name": "Red Brick Warehouse shops",
     "what": "Design goods and sweets"
    }
   ],
   "souvenirs": [
    {
     "item": "Origami set",
     "fair": "¥500 to ¥1,500"
    },
    {
     "item": "Japanese tea",
     "fair": "¥600 to ¥2,000"
    }
   ]
  },
  "hakodate": {
   "lang": "ja",
   "fairPrices": [
    {
     "route": "Pier to the morning market",
     "car": 10,
     "ceiling": 14
    },
    {
     "route": "Pier to the Mount Hakodate ropeway",
     "car": 16,
     "ceiling": 22
    }
   ],
   "taxiStand": "Taxis are metered and honest. Tipping is not expected. Use the pier rank or the tram stop.",
   "scams": [
    "Very few; keep an eye on belongings in busy markets",
    "Ask the price before you eat at a market stall"
   ],
   "phrases": [
    {
     "say": "こんにちは (Konnichiwa)",
     "means": "Hello, good day",
     "sounds": "kon-nee-chee-wah"
    },
    {
     "say": "ありがとう (Arigatō)",
     "means": "Thank you",
     "sounds": "ah-ree-gah-toh"
    },
    {
     "say": "いくらですか (Ikura desu ka)",
     "means": "How much is it?",
     "sounds": "ee-koo-rah dess kah"
    },
    {
     "say": "トイレはどこですか (Toire wa doko desu ka)",
     "means": "Where is the restroom?",
     "sounds": "toy-reh wah doh-koh dess kah"
    },
    {
     "say": "助けてください (Tasukete kudasai)",
     "means": "Please help me",
     "sounds": "tah-soo-keh-teh koo-dah-sigh"
    }
   ],
   "etiquette": [
    "Do not tip",
    "Remove shoes where asked"
   ],
   "allergy": [
    {
     "allergy": "Nuts",
     "language": "Japanese",
     "lang": "ja",
     "text": "私はナッツ類とピーナッツに重いアレルギーがあります。それらを含むもの、油や微量も食べられません。安全な料理を教えていただけますか？",
     "english": "I have a serious allergy to tree nuts and peanuts. I cannot eat anything that contains them, including oil or traces. Can you tell me which dishes are safe?"
    }
   ],
   "advisories": [
    "The weather changes quickly on the mountain; carry a layer",
    "Carry some cash for small shops"
   ],
   "laws": [
    "Some common medicines are restricted in Japan (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "hako-w1",
     "name": "Pier to the morning market",
     "minutes": 20,
     "step": "Walk along the waterfront to the market near the station.",
     "accessible": "Level paved route.",
     "sit": "Benches at the waterfront and market",
     "restroom": "Restrooms at the station and market"
    }
   ],
   "dayPasses": [
    {
     "id": "hako-p1",
     "name": "Ropeway ticket",
     "price": 16,
     "distance": "10 minutes by taxi",
     "crowd": "moderate"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Morning market stalls",
     "what": "Squid, crab and seafood bowls"
    },
    {
     "name": "Red Brick Warehouses",
     "what": "Glass and music boxes"
    }
   ],
   "souvenirs": [
    {
     "item": "Music box",
     "fair": "¥1,000 to ¥3,000"
    },
    {
     "item": "Dried seafood snack",
     "fair": "¥500 to ¥1,500"
    }
   ]
  },
  "singapore": {
   "fairPrices": [
    {
     "route": "Terminal to Marina Bay",
     "car": 10,
     "ceiling": 15
    },
    {
     "route": "Terminal to Chinatown",
     "car": 9,
     "ceiling": 13
    }
   ],
   "taxiStand": "Taxis are metered and honest. Surcharges apply at peak hours and from the terminal.",
   "scams": [
    "Very few; ignore touts offering “free” tours",
    "Watch bags in crowded Chinatown"
   ],
   "phrases": [],
   "etiquette": [
    "Do not tip; a service charge is added to bills",
    "Drink and eat only where allowed on the Metro"
   ],
   "allergy": [],
   "advisories": [
    "Heat and humidity: carry water and use the shade",
    "Short heavy showers are common; carry a rain jacket"
   ],
   "laws": [
    "Chewing gum cannot be brought in for sale; littering is fined heavily (verify)",
    "Vaping is illegal in Singapore (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "sing-w1",
     "name": "Terminal to the Marina Bay waterfront",
     "minutes": 60,
     "step": "Follow the waterfront promenade east along the bay.",
     "accessible": "Level paved path with lifts at bridges.",
     "sit": "Benches along the promenade",
     "restroom": "Restrooms along the promenade and at Marina Bay Sands"
    }
   ],
   "dayPasses": [
    {
     "id": "sing-p1",
     "name": "EZ-Link day travel (top-up)",
     "price": 10,
     "distance": "Metro and buses",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "Chinatown shops",
     "what": "Silk, tea and souvenirs"
    },
    {
     "name": "Little India stalls",
     "what": "Spices, sweets and textiles"
    }
   ],
   "souvenirs": [
    {
     "item": "Kaya jam",
     "fair": "S$4 to S$8"
    },
    {
     "item": "Silk scarf",
     "fair": "S$15 to S$40"
    }
   ]
  },
  "sydney": {
   "fairPrices": [
    {
     "route": "Circular Quay to Bondi Beach",
     "car": 40,
     "ceiling": 55
    },
    {
     "route": "Circular Quay to the airport",
     "car": 45,
     "ceiling": 60
    }
   ],
   "taxiStand": "Taxis are metered and wait at ranks. Ride-hailing is common. Surcharges apply at night.",
   "scams": [
    "Very few; watch for pickpockets in crowds",
    "Unlicensed tour touts around Circular Quay"
   ],
   "phrases": [],
   "etiquette": [
    "Tipping is not expected",
    "Wait for the “walk” signal; jaywalking is fined in some areas"
   ],
   "allergy": [],
   "advisories": [
    "Strong sun: sunscreen and a hat",
    "Swim only between the flags on beaches"
   ],
   "laws": [
    "Strict biosecurity rules apply to food and plants; declare everything (verify)",
    "Carry ID or a copy, not the original passport (verify)"
   ],
   "dontBringBack": [
    "Fresh fruit, meat and plants (strict Australian biosecurity)",
    "Counterfeit goods",
    "Duty-free: check the limits on the customs screen"
   ],
   "walks": [
    {
     "id": "sydn-w1",
     "name": "Circular Quay to the Botanic Garden",
     "minutes": 30,
     "step": "Follow the waterfront past the Opera House and into the garden.",
     "accessible": "Level paved path; some slopes in the garden.",
     "sit": "Benches along the foreshore",
     "restroom": "Restrooms at the Opera House and the garden"
    }
   ],
   "dayPasses": [
    {
     "id": "sydn-p1",
     "name": "Opal day cap (ferry, train, bus)",
     "price": 20,
     "distance": "City-wide",
     "crowd": "busy"
    }
   ],
   "kids": [
    "Shade: look for covered seating and carry a hat",
    "Strollers: main streets are paved; older quarters can be cobbled",
    "Changing: cafés and the larger attractions have family restrooms",
    "Food: simple plain dishes are easy to find"
   ],
   "vendors": [
    {
     "name": "The Rocks Market",
     "what": "Handmade crafts and food"
    },
    {
     "name": "Queen Victoria Building shops",
     "what": "Souvenirs and gifts"
    }
   ],
   "souvenirs": [
    {
     "item": "Local honey",
     "fair": "A$8 to A$15"
    },
    {
     "item": "Indigenous art print",
     "fair": "A$20 to A$60"
    }
   ]
  }
 },
 "coords": {
  "fll": [
   -80.1,
   26.1
  ],
  "cozumel": [
   -86.9,
   20.5
  ],
  "belize": [
   -88.2,
   17.5
  ],
  "roatan": [
   -86.5,
   16.3
  ],
  "celebration-key": [
   -78.7,
   26.53
  ],
  "grand-turk": [
   -71.14,
   21.46
  ],
  "san-juan": [
   -66.11,
   18.46
  ],
  "amber-cove": [
   -70.69,
   19.83
  ],
  "southampton": [
   -1.4,
   50.9
  ],
  "barcelona": [
   2.17,
   41.35
  ],
  "palma": [
   2.64,
   39.56
  ],
  "marseille": [
   5.35,
   43.3
  ],
  "genoa": [
   8.93,
   44.41
  ],
  "la-spezia": [
   9.83,
   44.1
  ],
  "civitavecchia": [
   11.79,
   42.09
  ],
  "naples": [
   14.26,
   40.84
  ],
  "athens": [
   23.64,
   37.94
  ],
  "santorini": [
   25.43,
   36.41
  ],
  "mykonos": [
   25.33,
   37.45
  ],
  "kusadasi": [
   27.26,
   37.86
  ],
  "copenhagen": [
   12.6,
   55.69
  ],
  "tokyo": [
   139.64,
   35.45
  ],
  "hakodate": [
   140.72,
   41.77
  ],
  "singapore": [
   103.82,
   1.26
  ],
  "sydney": [
   151.21,
   -33.86
  ]
 }
}
""";
}
