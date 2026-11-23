// The dining venues the first Explorer pass missed (docs/princess-restuarants.md, princess-bars.md): the specialty and experiential rooms, the poolside and pizza counters, the coffee
// and ice-cream bars, the pop-up and the bars of each ship. Authored concept content like the rest of the Explorer: plausible rooms in the right class, names from the docs.
// None can be reserved yet (`bookable: 'none'`): walk in, or ask the maître d'. Each carries a short standing menu (`dishes`, or `drinks` for a bar).
import type { HoursRule } from '../src/features/explorer/domain/types.ts'

export interface ExtraDining {
  /** The venue id without the ship's prefix. */
  key: string
  name: string
  kind: 'specialty' | 'casual' | 'bar'
  deck: string
  short: string
  long: string
  hours: HoursRule[]
  /** Cents per person; specialty rooms only. */
  cover?: number
  dishes?: string[]
  drinks?: string[]
  /** A pop-up or a room that runs only on some sailings. */
  popup?: boolean
}

const fixed = (a: string, b: string, when: ('sea' | 'night')[] = ['sea', 'night']): HoursRule[] => [{ kind: 'fixed', when, windows: [[a, b]] }]

const crooners = (deck: string): ExtraDining => ({ key: 'crooners-bar', name: 'Crooners Bar', kind: 'bar', deck, short: 'Rat Pack martinis and a piano sing-along.', hours: fixed('11:00', '24:00'),
  long: 'A mid-century martini and piano bar with more than 75 signature martinis and a resident pianist taking requests from early evening.', drinks: ['Frank’s Way dirty martini', 'The Sicilian Kiss', 'Key Lime Pie Martini', 'Tiramisu Martini', 'The Ultimate Vesper'] })
const goodSpirits = (deck: string): ExtraDining => ({ key: 'good-spirits', name: 'Good Spirits at Sea', kind: 'bar', deck, short: 'A cocktail laboratory of drinks made from ingredients of the ports.', hours: fixed('10:00', '24:00'),
  long: 'Bartenders build regional drinks from ingredients gathered around the world, with mixologist storytelling at five and eight in the evening.', drinks: ['Tuscan Rosemary', 'Smoked Oaxaca Margarita', 'Norwegian Cloudberry Fizz', 'Tasmanian Honey Old Fashioned', 'Zero-proof Cucumber Basil Smash'] })
const coffee = (deck: string, name = 'Coffee Currents'): ExtraDining => ({ key: 'coffee', name, kind: 'bar', deck, short: 'Espresso, tea and pastries, with soft-serve ice cream.', hours: fixed('06:00', '23:00'),
  long: 'Specialty coffee, loose-leaf tea and a case of pastries. Soft-serve ice cream cones are included in the fare; specialty coffee is extra unless you have a package.', drinks: ['Flat white', 'Caramel macchiato', 'Cold brew nitro coffee', 'Matcha green tea latte', 'Hot chocolate', 'Soft-serve cone'] })
const poolBar = (key: string, name: string, deck: string, short: string): ExtraDining => ({ key, name, kind: 'bar', deck, short, hours: fixed('09:00', '22:00'),
  long: `${short} Frozen drinks, beer and zero-proof mocktails; the bar closes with the pool.`, drinks: ['Princess Love Boat Dream', 'Miami Vice', 'Bahama Mama', 'Zero-proof Lava Flow', 'Draught lager'] })

const BUTCHERS: ExtraDining = { key: 'butchers-block', name: 'Butcher’s Block by Dario', kind: 'specialty', deck: 'Deck 7 midship', cover: 5500, hours: fixed('17:30', '21:30'),
  short: 'A family-style Tuscan butcher’s feast.', long: 'A shared tasting of dry-aged cuts in the style of the Tuscan butcher Dario Cecchini, served at long communal tables.',
  dishes: ['Beef Carpaccio', 'Tuscan Panzanella', 'Bistecca alla Fiorentina', 'Costata Ribeye', 'Roast Potatoes with Rosemary', 'Olive Oil Cake'] }
const UMAI: ExtraDining = { key: 'umai', name: 'Umai Teppanyaki & Hot Pot', kind: 'specialty', deck: 'Deck 8 aft', cover: 5500, hours: fixed('17:30', '21:30'),
  short: 'Hibachi tables and interactive hot pots.', long: 'Sit at a teppanyaki grill where the chef cooks in front of you, or share a bubbling dashi or spicy hot pot at the table.',
  dishes: ['Filet Mignon Teppanyaki', 'Scallops Teppanyaki', 'Vegetable Teppanyaki with Fried Rice', 'Dashi Hot Pot with Tofu and Mushrooms', 'Spicy Sichuan Hot Pot', 'Matcha Cheesecake'] }
const MAKOTO = (deck: string): ExtraDining => ({ key: 'makoto', name: 'Makoto Ocean', kind: 'specialty', deck, cover: 4500, hours: fixed('17:30', '21:30'),
  short: 'Edomae-style sushi and Japanese small plates.', long: 'Sushi, sashimi and small plates from Chef Makoto Okuwa, at a sushi bar and at tables.',
  dishes: ['Nigiri Selection', 'Spicy Tuna Roll', 'Vegetable Maki Roll', 'Miso Soup', 'Edamame', 'Black Cod Miso', 'Mochi Ice Cream'] })
const SANCTUARY: ExtraDining = { key: 'sanctuary-restaurant', name: 'The Sanctuary Restaurant', kind: 'specialty', deck: 'Deck 8 midship', hours: fixed('17:30', '21:30'),
  short: 'Private dining for Sanctuary Collection guests.', long: 'A quiet dining room reserved for guests of the Sanctuary Collection, with a tasting menu that changes each night. Not open to other guests.',
  dishes: ['Chilled Pea and Mint Soup', 'Seared Scallops with Cauliflower Purée', 'Roast Duck Breast', 'Wild Mushroom Tart', 'Chocolate Fondant'] }
const THREE60: ExtraDining = { key: 'ex-360', name: '360: An Extraordinary Experience', kind: 'specialty', deck: 'Deck 8 midship', cover: 14900, hours: fixed('18:30', '21:30'),
  short: 'An immersive dinner with projection on every wall.', long: 'A small-group tasting dinner in a room wrapped in projection, with each course matched to a scene. Limited seats; extra cost and not included in any package.',
  dishes: ['Ocean Oyster Course', 'Garden Terrine', 'Black Truffle Risotto', 'Herb-Crusted Lamb Loin', 'Chocolate Sphere'] }
const SALTY_DOG_GRILL: ExtraDining = { key: 'salty-dog-grill', name: 'Salty Dog Grill', kind: 'casual', deck: 'Deck 16 midship', hours: fixed('11:00', '18:00'),
  short: 'Poolside burgers, tacos and loaded fries.', long: 'Gourmet burgers, street tacos and loaded fries from the grill beside the pool.',
  dishes: ['Gourmet Burger', 'Plant-Based Burger', 'Street Tacos', 'Loaded Fries', 'Grilled Hot Dog'] }
const SLICE: ExtraDining = { key: 'slice', name: 'Slice Pizzeria', kind: 'casual', deck: 'Deck 16 midship', hours: fixed('11:00', '23:00'),
  short: 'New York-style pizza by the slice.', long: 'Large New York-style slices and whole pies, from morning snack to late night.',
  dishes: ['Cheese Pizza Slice', 'Pepperoni Pizza Slice', 'Margherita Pizza', 'Garden Veggie Pizza'] }
const SWIRLS: ExtraDining = { key: 'swirls', name: 'Swirls Ice Cream Bar', kind: 'casual', deck: 'Deck 16 midship', hours: fixed('10:00', '22:00'),
  short: 'Poolside soft-serve.', long: 'Vanilla, chocolate and swirl soft-serve in cones and cups, included in the fare.', dishes: ['Vanilla Soft-Serve', 'Chocolate Soft-Serve', 'Swirl Cone', 'Fruit Sorbet'] }

export const EXTRA_DINING: Record<string, ExtraDining[]> = {
  'sun-princess': [
    BUTCHERS, UMAI, MAKOTO('Deck 8 midship'), SANCTUARY, THREE60,
    { key: 'promenade-pizzeria', name: 'Promenade Pizzeria', kind: 'casual', deck: 'Deck 9 aft', hours: fixed('11:00', '23:00'), short: 'Pizza by the slice on the Promenade.',
      long: 'Slices and whole pizzas from the outdoor counter on the Promenade.', dishes: ['Cheese Pizza Slice', 'Pepperoni Pizza Slice', 'Garden Veggie Pizza', 'Margherita Pizza'] },
    { key: 'lido-grill', name: 'Lido Grill and Tacos', kind: 'casual', deck: 'Deck 17 midship', hours: fixed('11:00', '18:00'), short: 'Burgers, hot dogs and tacos by the pool.',
      long: 'The poolside grill and taco counter of the Lido: burgers, hot dogs, street tacos and a plant-based burger.', dishes: ['Cheeseburger', 'Plant-Based Burger', 'Grilled Hot Dog', 'Street Tacos', 'Loaded Fries'] },
    coffee('Deck 7 midship'), crooners('Deck 7 midship'), goodSpirits('Deck 7 midship'),
    poolBar('sea-view-bar', 'SeaView Bar', 'Deck 17 forward', 'A poolside bar beside the big screen.'),
    poolBar('wake-view-bar', 'Wake View Bar', 'Deck 8 aft', 'A sunset bar at the stern over the wake.'),
    poolBar('sun-bar', 'Sun Bar', 'Deck 19 forward', 'An adults-friendly bar on the sun deck.'),
  ],
  'sky-princess': [
    SALTY_DOG_GRILL, SLICE, SWIRLS,
    { key: 'pastry-shop', name: 'The Pastry Shop', kind: 'casual', deck: 'Deck 16 midship', hours: fixed('06:00', '22:00'), short: 'A bakery counter beside the buffet.',
      long: 'Pastries, cakes and cookies baked on board, beside the World Fresh Marketplace.', dishes: ['Butter Croissant', 'Almond Croissant', 'Blueberry Muffin', 'Fruit Danish', 'Chocolate Chip Cookie', 'Vegan Oat Cookie'] },
    { key: 'omalleys', name: 'O’Malley’s Irish Pub', kind: 'casual', deck: 'Deck 5 midship', hours: fixed('11:30', '24:00'), short: 'Pub classics, draught beer and Irish whiskey.',
      long: 'Pub food and a short prix fixe menu beside the Piazza, with live folk music in the evening.', dishes: ['Fish and Chips', 'Shepherd’s Pie', 'Bangers and Mash', 'Irish Stew', 'Bread and Butter Pudding'] },
    { key: 'ocean-terrace-sushi', name: 'Ocean Terrace Sushi Bar', kind: 'casual', deck: 'Deck 7 midship', hours: fixed('11:30', '22:00'), short: 'Nigiri, sashimi and specialty rolls over the Piazza.',
      long: 'A small sushi bar on the Piazza balcony with nigiri, sashimi and specialty rolls.', dishes: ['Nigiri Selection', 'California Roll', 'Vegetable Maki Roll', 'Spicy Tuna Roll', 'Edamame', 'Miso Soup'] },
    { key: 'catch', name: 'The Catch by Rudi', kind: 'specialty', deck: 'Deck 7 midship', cover: 5500, hours: fixed('17:30', '21:30'), short: 'Contemporary seafood by Chef Rudi Sodamin.',
      long: 'A seafood dinner built around the catch of the day, with raw bar starters and a lobster main.', dishes: ['Lobster Bisque', 'Raw Bar Platter', 'Grilled Catch of the Day', 'Butter-Poached Lobster', 'Roasted Corn Salad', 'Key Lime Tart'] },
    coffee('Deck 5 midship', 'Coffee and Cones'), crooners('Deck 6 midship'), goodSpirits('Deck 5 Piazza'),
    { key: 'bellinis', name: 'Bellini’s', kind: 'bar', deck: 'Deck 6 Piazza', short: 'Sparkling Italian cocktails over the Piazza.', hours: fixed('10:00', '23:30'),
      long: 'A sparkling Italian cocktail bar with Bellinis, spritzes and Prosecco.', drinks: ['Classic Venetian Bellini', 'Aperol Spritz', 'Limoncello Spritz', 'Rossini'] },
    poolBar('wake-view-bar', 'Wake View Bar', 'Deck 16 aft', 'An aft pool bar over the wake.'),
    poolBar('mermaids-tail', 'Mermaid’s Tail Bar', 'Deck 16 midship', 'The bar for the Sky Pool and its hot tubs.'),
  ],
  'sapphire-princess': [
    { key: 'prego', name: 'Prego Pizzeria', kind: 'casual', deck: 'Deck 14 midship', hours: fixed('11:00', '23:00'), short: 'Poolside pizza by the slice.',
      long: 'Hand-tossed pizza by the slice and the pie, beside the Calypso pool.', dishes: ['Cheese Pizza Slice', 'Pepperoni Pizza Slice', 'Garden Veggie Pizza', 'Margherita Pizza'] },
    { key: 'trident-grill', name: 'Trident Grill', kind: 'casual', deck: 'Deck 14 midship', hours: fixed('11:00', '18:00'), short: 'Burgers, hot dogs and bratwurst by the pool.',
      long: 'The poolside grill: burgers, hot dogs, bratwurst and fries.', dishes: ['Cheeseburger', 'Plant-Based Burger', 'Grilled Hot Dog', 'Bratwurst', 'Fries'] },
    { key: 'swirls', name: 'Swirls Ice Cream', kind: 'casual', deck: 'Deck 14 midship', hours: fixed('10:00', '22:00'), short: 'Soft-serve and sundaes.',
      long: 'Vanilla, chocolate and swirl soft-serve and a build-your-own sundae, included in the fare.', dishes: ['Vanilla Soft-Serve', 'Chocolate Soft-Serve', 'Swirl Cone', 'Build-Your-Own Sundae', 'Fruit Sorbet'] },
    { key: 'salty-dog-gastropub', name: 'Salty Dog Gastropub', kind: 'casual', deck: 'Deck 7 midship', hours: fixed('11:30', '22:00'), short: 'A gourmet pub menu with a short prix fixe dinner.',
      long: 'Elevated pub food (the Ernesto burger, short rib poutine) and craft beer, with an evening prix fixe.', dishes: ['The Ernesto Burger', 'Short Rib Poutine', 'Fish and Chips', 'Vegetable Pot Pie', 'Sticky Toffee Date Pudding'] },
    MAKOTO('Deck 7 midship'),
    { key: 'crab-shack', name: 'Crab Shack (pop-up)', kind: 'specialty', deck: 'Deck 14 aft', cover: 4500, popup: true, hours: fixed('17:30', '21:00'),
      short: 'A pop-up seafood boil on selected nights.', long: 'A seafood boil served on the open deck at the stern on selected nights: crab, shrimp, corn and potatoes with plenty of napkins. Runs on some sailings only.',
      dishes: ['Snow Crab Clusters', 'Shrimp Boil', 'Corn on the Cob', 'Red Potatoes', 'Cornbread', 'Key Lime Pie'] },
    coffee('Deck 14 midship', 'Coffee and Cones'), crooners('Deck 7 midship'),
    poolBar('wake-view-bar', 'Wake View Bar', 'Deck 14 aft', 'An aft pool bar over the wake.'),
    poolBar('calypso-bar', 'Calypso Bar', 'Deck 14 midship', 'The bar of the Calypso Reef pool.'),
    poolBar('outrigger-bar', 'Outrigger Bar', 'Deck 14 forward', 'A bar at the forward end of the pool deck.'),
  ],
}
