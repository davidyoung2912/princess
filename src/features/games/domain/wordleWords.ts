/**
 * The target words for Cruise Wordle: five-letter cruise, ship, port, food, wildlife and travel words that a guest on board will know. Upper case, no repeats.
 * Any five letters may be guessed (there is no dictionary); only these can be the answer.
 */
export const WORDLE_WORDS: readonly string[] = [
  // The ship
  'DECKS', 'CABIN', 'BERTH', 'BOARD', 'DOCKS', 'PIERS', 'STERN', 'HELMS', 'MASTS', 'KEELS', 'HULLS', 'LINER',
  'FLEET', 'MATES', 'MATEY', 'KNOTS', 'ROPES', 'FERRY', 'YACHT', 'SUITE', 'VESTS', 'DRILL', 'ALARM', 'SIREN',
  'HORNS', 'BELLS', 'FLAGS', 'FLARE', 'BUOYS', 'LIGHT', 'RADAR', 'CLOCK',
  // The sea and the weather
  'OCEAN', 'WAVES', 'SAILS', 'TIDES', 'TIDAL', 'SWELL', 'WINDS', 'STORM', 'CLOUD', 'SUNNY', 'DAWNS', 'FOGGY',
  'BRINE', 'SALTY', 'WAKES', 'MISTY',
  // Coast and islands
  'SHORE', 'ISLES', 'COAST', 'BEACH', 'SANDS', 'SHELL', 'CORAL', 'REEFS', 'BAYOU', 'COVES', 'CLIFF', 'DUNES',
  'PALMS', 'FJORD', 'CAPES', 'RIVER', 'LANDS', 'HILLS', 'RIDGE', 'BLUFF',
  // Wildlife
  'WHALE', 'SEALS', 'MANTA', 'SHARK', 'OTTER', 'GULLS', 'CRABS', 'SQUID', 'EAGLE', 'HERON', 'ORCAS', 'SKATE',
  'PRAWN', 'CLAMS',
  // Food and drink
  'DINER', 'SNACK', 'FEAST', 'PASTA', 'SUSHI', 'TACOS', 'SALAD', 'DRINK', 'WINES', 'TOAST', 'CAFES', 'LATTE',
  'CHEFS', 'MENUS', 'SWEET', 'CREAM', 'BREAD', 'STEAK', 'LEMON', 'MANGO', 'OLIVE', 'PIZZA', 'CURRY', 'SPICE',
  'BERRY', 'JUICE', 'COCOA', 'GRILL',
  // Spa, pool and fun
  'RELAX', 'TOWEL', 'ROBES', 'STEAM', 'SAUNA', 'POOLS', 'SLIDE', 'SWIMS', 'DANCE', 'SHOWS', 'MUSIC', 'CARDS',
  'BINGO', 'STAGE', 'COMIC', 'MOVIE', 'PARTY', 'CHEER', 'GUEST', 'VIEWS', 'SCENE', 'PHOTO', 'SNAPS', 'CHAIR',
  'DIVES', 'DIVER', 'LAUGH', 'MAGIC', 'BANJO', 'PIANO',
  // Maps, documents and luggage
  'GLOBE', 'ATLAS', 'ROUTE', 'TRAIL', 'GUIDE', 'VISAS', 'TRUNK', 'PACKS', 'CARRY', 'STAMP', 'PLANE', 'TAXIS',
  'TRAIN', 'METRO', 'HOTEL', 'VILLA', 'LODGE', 'CAMPS', 'TENTS', 'HIKES', 'TREKS', 'VISIT', 'ROAMS', 'SIGHT',
  'TOWER', 'PLAZA', 'SOUKS', 'GIFTS', 'CRAFT', 'TOURS', 'TRIPS', 'LOCAL', 'ENTRY', 'LEAVE', 'EXTRA', 'FARES',
  'CLASS', 'BOOKS', 'PRIZE',
  // Places
  'SPAIN', 'ITALY', 'MALTA', 'CRETE', 'ARUBA', 'JAPAN', 'CHINA', 'INDIA', 'EGYPT', 'KENYA', 'PARIS', 'TOKYO',
  'DUBAI', 'SITKA', 'CORFU', 'HAITI', 'SAMOA', 'TONGA', 'GHANA', 'CHILE',
]
