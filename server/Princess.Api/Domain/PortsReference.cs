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
  ]
 }
}
""";
}
