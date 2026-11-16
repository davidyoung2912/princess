// The Dining Explorer content that goes with the dining rooms (docs/princess-restuarants.md, princess-bars.md, princess-special-events.md): the bars, the events that run
// at them (winemaker dinners, tastings, afternoon tea, the pub lunch) and the menus. Authored concept content, with start times the docs leave out chosen here for review.
import type { DirectoryVenue } from '../src/domain/menus.ts'
import { dishCopy } from '../src/domain/dishCopy.ts'
import type { HoursRule } from '../src/domain/explorer/types.ts'
import { fillSection, kindOf, marksOf, isNas, sectionsOf, type MenuCourse } from './ship-explorer-diets.ts'
import { EXTRA_DINING, type ExtraDining } from './ship-explorer-extra-dining.ts'
import type { ExplorerEventRow, ExplorerVenueRow, MealCourseRow, MealMenuRow } from './ship-explorer-data.ts'

type Contains = 'meat' | 'pork' | 'fish' | 'shellfish' | 'dairy' | 'egg' | 'gluten' | 'nuts'

/** What a dish contains, guessed from its name; the guest is still told to ask about allergies. Authored here so each dish is tagged the same way every time. */
const TAGS: [RegExp, Contains[]][] = [
  [/prosciutto|bacon|sausage|pork|ham\b|chorizo|belly|bratwurst|knuckle|ribs/i, ['pork', 'meat']],
  [/beef|steak|lamb|veal|duck|chicken|turkey|filet|short rib|wellington|chateaubriand|burger|osso buco|foie|carpaccio|patty|meatloaf|wagyu|tenderloin|gyro/i, ['meat']],
  [/salmon|barramundi|cod|trout|branzino|mahi|tuna|bass|fish|sole|anchov|caesar|niçoise|nicoise|ceviche/i, ['fish']],
  [/shrimp|prawn|lobster|crab|scallop|calamari|octopus|escargot|seafood|cioppino|oyster|bisque/i, ['shellfish']],
  [/cheese|cream|butter|burrata|ricotta|risotto|gratin|mousse|tart\b|tiramisu|cannoli|panna|brûlée|brulee|custard|soufflé|souffle|mille-feuille|cheesecake|parmigiana|parmesan|manicotti|ravioli|gnocchi|dip\b|bisque|latte|milkshake|pancake|french toast|benedict|royale|frittata|omelet|omelette|torte|alaska|strudel|baklava|opera|chowder/i, ['dairy']],
  [/\beggs?\b|benedict|royale|frittata|omelet|omelette|soufflé|souffle|brûlée|brulee|custard|mousse|tiramisu|french toast|pancake|shakshuka|huevos|burrito|aioli|tortelloni/i, ['egg']],
  [/bread|pasta|ravioli|gnocchi|risotto|wellington|tart\b|cake|pancake|waffle|toast|burger|taco|burrito|pizza|bao|strudel|cannoli|croissant|danish|muffin|sandwich|schnitzel|manicotti|arancini|spring roll|noodle|pad thai|cobbler|torte|baklava|tiramisu|crouton|caesar|cheesecake|opera|mille-feuille|biscotti|linguine|spaghetti|tagliatelle|gyro|pita|scone|bun\b/i, ['gluten']],
  [/almond|hazelnut|walnut|pecan|nut\b|nuts\b|pistachio|pesto|rocher|nutella|biscotti|baklava|romesco/i, ['nuts']],
]

export const tagsOf = (name: string): Contains[] => {
  const out = new Set<Contains>()
  for (const [re, tags] of TAGS) if (re.test(name)) for (const x of tags) out.add(x)
  return [...out].sort()
}

const dishes = (names: string[]) => names.map((plain) => { const c = dishCopy(plain); return { name: c.name, contains: tagsOf(plain), ...(c.description ? { note: c.description } : {}) } })
const course = (name: string, names: string[]): MealCourseRow => ({ name, dishes: dishes(names) })

// The doc's seven evenings (docs/princess-restuarants.md "7-Day Rotating MDR Dinner Menu"). Days 2 and 6 are the formal nights.
interface Night { theme: string; formal: boolean; starters: string[]; mains: string[]; desserts: string[] }
const NIGHTS: Night[] = [
  { theme: 'Sailaway Dinner', formal: false, starters: ['Prosciutto & Melon', 'Crab & Artichoke Dip', 'Roasted Tomato Basil Soup'], mains: ['Prime Rib of Beef au Jus', 'Pan-Seared Barramundi', 'Wild Mushroom Risotto'], desserts: ['Princess Love Boat Dream (chocolate mousse)', 'Key Lime Tart'] },
  { theme: 'Captain’s Welcome (Formal)', formal: true, starters: ['Beef Carpaccio', 'Sea Scallops Gratin', 'Duck Consommé'], mains: ['Beef Wellington with Truffle Demi-Glace', 'Butter-Poached Lobster Tail & Prawns', 'Truffle Gnocchi'], desserts: ['Grand Marnier Soufflé', 'Opera Cake'] },
  { theme: 'Italian Night', formal: false, starters: ['Burrata & Heirloom Tomato', 'Arancini', 'Pasta e Fagioli'], mains: ['Osso Buco Milanese', 'Cioppino Seafood Stew', 'Eggplant Parmigiana'], desserts: ['Tiramisu', 'Sicilian Cannoli'] },
  { theme: 'Mediterranean & Coastal', formal: false, starters: ['Octopus Carpaccio', 'Spanakopita', 'Chilled Gazpacho'], mains: ['Herb-Crusted Rack of Lamb', 'Grilled Branzino with Lemon Caper Butter', 'Moroccan Vegetable Tagine'], desserts: ['Baklava Cheesecake', 'Lemon Panna Cotta'] },
  { theme: 'Chef’s Signature Night', formal: false, starters: ['Tuna Tartare', 'Pork Belly Bao', 'Lobster Bisque'], mains: ['Chateaubriand with Béarnaise', 'Miso-Glazed Black Cod', 'Butternut Squash Ravioli'], desserts: ['Chocolate Hazelnut Normande', 'Crème Brûlée'] },
  { theme: 'Captain’s Gala (Formal)', formal: true, starters: ['Escargots Bourguignon', 'Foie Gras Terrine', 'Cream of Asparagus Soup'], mains: ['Surf & Turf (Filet Mignon & King Crab/Lobster)', 'Duck à l’Orange', 'Cauliflower Steak with Romesco'], desserts: ['Baked Alaska Parade', 'Raspberry Mille-Feuille'] },
  { theme: 'Landfall & Farewell Dinner', formal: false, starters: ['Smoked Salmon Roulade', 'Crispy Spring Rolls', 'Chicken & Sweet Corn Chowder'], mains: ['Slow-Roasted Turkey Dinner', 'Grilled Mahi-Mahi with Mango Salsa', 'Spinach & Ricotta Manicotti'], desserts: ['Warm Apple Strudel', 'Flourless Chocolate Torte'] },
]
const FAVOURITES = ['Shrimp Cocktail', 'Caesar Salad', 'French Onion Soup', 'Grilled Salmon', 'Herb-Roasted Chicken', 'New York Strip Steak']

const BREAKFAST_CORE = ['Assorted Danish & Croissants', 'Bircher Muesli', 'Classic Eggs Benedict', 'Eggs Royale (Smoked Salmon Benedict)', 'Three-Egg Custom Omelet', 'Buttermilk Pancakes with Bacon', 'Brioche French Toast', 'Corned Beef Hash']
const BREAKFAST_SPECIAL = ['Huevos Rancheros', 'Smoked Trout & Dill Frittata', 'Lemon-Ricotta Blueberry Pancakes', 'Middle Eastern Shakshuka', 'Loaded Southwest Breakfast Burrito', 'Grilled Asparagus & Truffle Scrambled Eggs', 'Cinnamon Roll French Toast']
const LUNCH_CORE = ['Calamari Fritti', 'Chilled Avocado & Cucumber Soup', 'Pan-Seared Salmon Niçoise', 'The Princess Classic Burger with Truffle Fries', 'Baja Fish Street Tacos']
const LUNCH_SPECIAL: Record<number, string> = { 2: 'Thai Red Curry', 5: 'Seafood Linguine' }

const BUFFET_NIGHTS: { theme: string; dishes: string[] }[] = [
  { theme: 'Sailaway Seafood & Carvery', dishes: ['Peel-and-eat shrimp', 'Prime rib carving', 'Roast salmon'] },
  { theme: 'Taste of Italy', dishes: ['Lasagna', 'Osso buco', 'Made-to-order risotto', 'Antipasti bar'] },
  { theme: 'Asian Night', dishes: ['Dim sum', 'Peking duck', 'Korean BBQ beef', 'Pad thai', 'Sushi rolls'] },
  { theme: 'Mediterranean & Greek', dishes: ['Lamb gyros', 'Moussaka', 'Grilled souvlaki', 'Meze platters'] },
  { theme: 'Tex-Mex & Latin Fiesta', dishes: ['Fajita bar', 'Carnitas', 'Empanadas', 'Ceviche', 'Churros'] },
  { theme: 'Bavarian & European Carvery', dishes: ['Roast pork knuckle', 'Bratwurst', 'Schnitzel', 'Strudel'] },
  { theme: 'American Classics & Farewell', dishes: ['BBQ ribs', 'Fried chicken', 'Mac & cheese', 'Carved turkey'] },
]
const BUFFET_BREAKFAST = ['Made-to-order omelet station', 'Pancakes & waffles', 'Bacon & sausages', 'Hash browns', 'Oatmeal & congee bar', 'Smoked salmon & bagels', 'Fresh fruit', 'Pastries']
const BUFFET_LUNCH = ['Carving station (roast turkey, ham or pork loin)', 'Salad bar', 'Build-your-own pasta station', 'Burger & hot dog grill', 'Asian noodle & stir-fry station', 'Deli sandwiches', 'Sugar-free & gluten-free dessert corner']

/** The dining rooms whose hours cover a time on a sea day. */
const opensAt = (v: ExplorerVenueRow, time: string): boolean =>
  v.hours.some((h: HoursRule) => h.kind === 'fixed' && h.when.includes('sea') && h.windows.some(([a, b]) => a <= time && time < b))

/** Menus of the main dining rooms, the buffet, and a standing menu for every other dining room from the directory. */
export function diningMenus(venues: readonly ExplorerVenueRow[], directory: readonly DirectoryVenue[]): MealMenuRow[] {
  const out: MealMenuRow[] = []
  for (const v of venues) {
    if (v.explorer !== 'dining') continue
    if (v.kind === 'main') {
      if (opensAt(v, '07:00')) {
        for (let day = 1; day <= 7; day++) out.push({ venueId: v.id, meal: 'breakfast', from: '07:00', to: '09:30', templateDay: day, title: 'Breakfast', courses: [fill(course('Every morning', BREAKFAST_CORE), 'breakfast', `${v.id}|b|${day}`, 2), course('Chef’s special today', [BREAKFAST_SPECIAL[day - 1]])] })
      }
      if (opensAt(v, '12:00')) {
        for (const day of [2, 5]) out.push({ venueId: v.id, meal: 'lunch', from: '12:00', to: '13:30', templateDay: day, title: 'Sea day lunch', courses: [fill(course('Every sea day', LUNCH_CORE), 'lunch', `${v.id}|l|${day}`, 2), course('Chef’s special today', [LUNCH_SPECIAL[day]])] })
      }
      NIGHTS.forEach((n, i) => out.push({ venueId: v.id, meal: 'dinner', from: '17:30', to: '21:30', templateDay: i + 1, title: 'Dinner', theme: n.theme, formal: n.formal,
        courses: [fill(course('Starters & soups', n.starters), 'starter', `${v.id}|${i}|s`, 2), fill(course('Entrées', n.mains), 'main', `${v.id}|${i}|m`, 2), fill(course('Desserts', n.desserts), 'dessert', `${v.id}|${i}|d`, 2), fill(course('Princess Favorites, every night', FAVOURITES), 'favourite', `${v.id}|${i}|f`, 1)] }))
    } else if (/eatery$/.test(v.id)) {
      out.push({ venueId: v.id, meal: 'breakfast', from: '06:00', to: '11:00', templateDay: 0, title: 'Breakfast', courses: [fill(course('Stations', BUFFET_BREAKFAST), 'breakfast', `${v.id}|bb`, 2)] })
      out.push({ venueId: v.id, meal: 'lunch', from: '11:30', to: '15:00', templateDay: 0, title: 'Lunch', courses: [fill(course('Stations', BUFFET_LUNCH), 'lunch', `${v.id}|bl`, 2)] })
      BUFFET_NIGHTS.forEach((n, i) => out.push({ venueId: v.id, meal: 'dinner', from: '17:30', to: '22:00', templateDay: i + 1, title: 'Dinner', theme: n.theme, courses: [fill(course('Salads & starters', []), 'starter', `${v.id}|${i}|bs`, 2), fill(course('Tonight’s stations', n.dishes), 'main', `${v.id}|${i}|bm`, 2), fill(course('Desserts & fruit', []), 'dessert', `${v.id}|${i}|bd`, 2)] }))
    } else if (extraOf(v.id)) {
      const x = extraOf(v.id)!
      const names = x.kind === 'bar' ? (x.drinks ?? []) : (x.dishes ?? [])
      out.push({ venueId: v.id, meal: 'allDay', from: x.kind === 'bar' ? '10:00' : '00:00', to: '24:00', templateDay: 0, title: x.kind === 'bar' ? 'Signature drinks' : 'The menu', courses: standing(x.kind === 'bar' ? [fill(course('Signatures', names), 'drink', `${v.id}|x`, 1)] : sectionsOf(dishes(names)), v.id, x.kind === 'specialty') })
    } else if (v.kind === 'bar') {
      out.push({ venueId: v.id, meal: 'allDay', from: '10:00', to: '24:00', templateDay: 0, title: 'Signature drinks', courses: [fill(course('Signatures', BAR_DRINKS[v.id.replace(/^(sky|sapphire)-/, '')] ?? []), 'drink', `${v.id}|x`, 1)] })
    } else {
      const d = directory.find((x) => x.id === v.id)
      if (d && d.dishes.length > 0) out.push({ venueId: v.id, meal: 'allDay', from: '00:00', to: '24:00', templateDay: 0, title: 'The menu', courses: standing(sectionsOf(d.dishes.map((x) => ({ name: x.name, contains: [...x.contains].sort(), ...(x.description ? { note: x.description } : {}) }))), v.id, v.kind === 'specialty') })
    }
  }
  // Every dish carries its marks, including the single chef's specials the sections above leave alone.
  for (const m of out) for (const c of m.courses) c.dishes = c.dishes.map((d) => (d.marks ? d : { ...d, marks: marksOf(d.name, d.contains, isNas(d.name)) }))
  return out
}

const fill = (c: MenuCourse, kind: Parameters<typeof fillSection>[1], seed: string, extra: number): MenuCourse => fillSection(c, kind, seed, extra)

/** A standing menu's sections, each filled out; a specialty restaurant also gets the sections it lacks, so every one has vegan, vegetarian and NAS choices. */
function standing(sections: MenuCourse[], seed: string, all: boolean): MenuCourse[] {
  const out = sections.map((c) => c.name === 'Signatures' ? c : fill(c, c.name === 'Starters' ? 'starter' : c.name === 'Desserts' ? 'dessert' : c.name === 'Mains' ? 'main' : kindOf(c.name, 'allDay'), `${seed}|${c.name}`, 1))
  if (all) for (const [name, kind] of [['Starters', 'starter'], ['Mains', 'main'], ['Desserts', 'dessert']] as const) if (!out.some((c) => c.name === name)) out.push(fill({ name, dishes: [] }, kind, `${seed}|${name}`, 1))
  const order = ['Starters', 'Mains', 'Desserts']
  return out.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
}

const BAR_DRINKS: Record<string, string[]> = {
  bellinis: ['Classic Venetian Bellini', 'Aperol Spritz', 'Limoncello Spritz', 'Rossini'],
  vines: ['Wine flight with the sommelier', 'House sparkling', 'Reserve pour of Merlot', 'Tapas & sushi bites'],
  wheelhouse: ['Classic Old Fashioned', 'Rob Roy', 'Negroni', 'Single-malt pours'],
}

const BAR_DETAILS: Record<string, { name: string; deck: string; short: string; long: string; hours: HoursRule[] }> = {
  bellinis: { name: 'Bellini’s', deck: 'Deck 7 midship', short: 'Sparkling Italian cocktails overlooking the Piazza.', long: 'A sparkling Italian cocktail bar with Bellinis, spritzes and Prosecco. Drinks are included with Plus and Premier.', hours: [{ kind: 'fixed', when: ['sea', 'night'], windows: [['10:00', '23:30']] }] },
  vines: { name: 'Vines Wine Bar', deck: 'Deck 5 Piazza', short: 'Wine by the glass, flights and small bites.', long: 'An intimate wine lounge with more than 30 wines by the glass, sommelier flights and tapas with your wine.', hours: [{ kind: 'fixed', when: ['sea', 'night'], windows: [['11:00', '23:30']] }] },
  wheelhouse: { name: 'Wheelhouse Bar', deck: 'Deck 7 midship', short: 'Single malts, bourbons and classic cocktails.', long: 'A traditional nautical lounge for single-malt Scotch, small-batch bourbon and classic pre-dinner cocktails.', hours: [{ kind: 'fixed', when: ['sea', 'night'], windows: [['11:00', '24:00']] }] },
}

const EXTRA_BY_ID = new Map<string, ExtraDining>()
for (const [ship, list] of Object.entries(EXTRA_DINING)) for (const x of list) EXTRA_BY_ID.set(`${ship === 'sun-princess' ? '' : ship === 'sky-princess' ? 'sky-' : 'sapphire-'}${x.key}`, x)
const extraOf = (id: string): ExtraDining | undefined => EXTRA_BY_ID.get(id)

/** The venues the first pass missed (`ship-explorer-extra-dining.ts`), as Dining rows. */
export function extraDiningVenues(shipId: string, prefix: string, firstOrder: number): ExplorerVenueRow[] {
  return (EXTRA_DINING[shipId] ?? []).map((x, i) => ({
    id: `${prefix}${x.key}`, explorer: 'dining', kind: x.kind, title: x.name, short: x.short, long: x.long, placeId: `${prefix}${x.key}`, deckLabel: x.deck, hours: x.hours,
    ...(x.cover ? { cover: x.cover } : {}), bookable: 'none', order: firstOrder + i,
    features: [x.kind === 'bar' ? 'Bar' : x.kind === 'specialty' ? (x.popup ? 'Pop-up' : 'Specialty restaurant') : 'Casual dining', ...(x.kind === 'bar' ? [] : ['Dress: casual'])], accessibility: [],
  }))
}

/** The bars of a ship, which live in Dining. `prefix` is '' for Sun and 'sky-' or 'sapphire-' for the others. */
export function diningBars(prefix: string, keys: readonly string[], firstOrder: number): ExplorerVenueRow[] {
  return keys.map((key, i) => {
    const b = BAR_DETAILS[key]
    return { id: `${prefix}${key}`, explorer: 'dining', kind: 'bar', title: b.name, short: b.short, long: b.long, placeId: `${prefix}${key}`, deckLabel: b.deck, hours: b.hours, bookable: 'none', order: firstOrder + i, features: ['Bar', 'Dress: casual'], accessibility: [] }
  })
}

const ev = (id: string, venueId: string, when: string[], start: string, minutes: number, title: string, detail: string, o: Partial<ExplorerEventRow> = {}): ExplorerEventRow =>
  ({ id, venueId, when, start, minutes, title, detail, age: 'adults', interest: 'food', extra: 0, ...o })

/** Events of the Dining Explorer for a ship: `ids` names the rooms this ship has. */
export function diningEvents(ids: { anytime: string; crown: string; cafe: string; bar: string; pub?: string; chefsTable?: string }): ExplorerEventRow[] {
  const out: ExplorerEventRow[] = [
    ev(`winemaker-${ids.anytime}`, ids.anytime, ['seaMid'], '18:00', 150, 'Winemaker’s dinner', 'A multi-course dinner with wine pairings, hosted by the head sommelier and the executive chef, in a private alcove of the dining room for 12 guests.', { extra: 5500, capacity: 12 }),
    ev(`caymus-${ids.crown}`, ids.crown, ['portEven'], '18:30', 150, 'Caymus Vineyards winemaker dinner', 'A five-course steakhouse tasting menu paired with Napa Valley wines from Caymus Vineyards.', { extra: 15000, capacity: 24 }),
    ev(`tea-${ids.cafe}`, ids.cafe, ['night'], '15:30', 60, 'Afternoon tea', 'Finger sandwiches, warm scones with clotted cream and jam, petit fours and loose-leaf teas.', { age: 'all', interest: 'food' }),
    ev(`tasting-${ids.bar}`, ids.bar, ['seaMid'], '16:00', 60, 'Guided tasting with the sommelier', 'A sommelier-led tasting of prestige cuvées and Super Tuscans.', { extra: 3500, capacity: 20 }),
  ]
  if (ids.pub) out.push(ev(`pub-lunch-${ids.pub}`, ids.pub, ['sea'], '12:00', 120, 'Sea day pub lunch', 'Fish and chips, bangers and mash, a ploughman’s lunch and bread and butter pudding.', { age: 'all' }))
  if (ids.chefsTable) out.push(ev(`chefs-table-${ids.chefsTable}`, ids.chefsTable, ['seaMid'], '18:30', 150, 'Chef’s Table Lumiere', 'A multi-course dinner that starts with a galley tour, then a private curtained table.', { extra: 11500, capacity: 12 }))
  return out
}
