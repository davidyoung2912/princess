// Diet marks for the menus of the Explorer: Vegan, Vegetarian and NAS (no added sugar). A dish's `marks` are worked out here from what it contains, and every section of every menu
// is topped up from the pools below so that each has at least one vegan dish, one vegetarian dish and one NAS dish, and a wider choice besides. Authored concept content: the marks
// are a guide like the allergen tags, and the screen tells the guest to ask the maître d' about anything that matters to them.
type Contains = 'meat' | 'pork' | 'fish' | 'shellfish' | 'dairy' | 'egg' | 'gluten' | 'nuts'
export type Mark = 'vegan' | 'vegetarian' | 'nas'
export interface MenuDish { name: string; contains: string[]; note?: string; marks?: Mark[] }
export interface MenuCourse { name: string; dishes: MenuDish[] }

/** What a dish is marked as. Vegan: nothing from an animal (and no honey or gelatine); vegetarian: no meat, fish or shellfish but something from an animal. */
export function marksOf(name: string, contains: readonly string[], nas = false): Mark[] {
  const marks: Mark[] = []
  const animal = ['meat', 'pork', 'fish', 'shellfish'].some((c) => contains.includes(c))
  const hidden = /honey|gelatin|anchov|worcester|lard|bone broth|oyster sauce/i.test(name)
  if (!animal && !hidden) marks.push(['dairy', 'egg'].some((c) => contains.includes(c)) ? 'vegetarian' : 'vegan')
  if (nas) marks.push('nas')
  return marks
}

const SWEET = /glaz|teriyaki|bbq|barbecue|honey|sweet|candied|maple|chocolate|cake|tart\b|pie\b|ice cream|sorbet|pudding|cookie|pastry|danish|croissant|muffin|pancake|waffle|french toast|cinnamon|milkshake|brownie|sundae|mousse|cheesecake|strudel|tiramisu|cannoli|baklava|souffl|brûlée|brulee|alaska|macaron|mochi|churro|fudge|syrup|jam\b|marmalade|lava|torte|opera|panna|key lime|mille|sticky|toffee|normande|candy|soft-serve|cone\b|cocktail|bellini|spritz|martini|daiquiri|colada|mule|margarita|lemonade|latte|mocha|macchiato|hot chocolate|biscotti|fondant|crumble|sphere|rossini|miami vice|bahama|love boat|lava flow|cider/i
const PLAIN = /fruit|salad|grilled|roast|seared|carved|poached|steamed|omelet|omelette|scrambled|\begg|sashimi|nigiri|tartare|carpaccio|edamame|miso soup|consomm|gazpacho|ceviche|tagine|stir-fry|vegetable|veggie|cauliflower|steak|filet|prime rib|lamb|salmon|branzino|barramundi|mahi|cod\b|chicken|turkey|duck|scallop|shrimp|lobster|crab|oyster|greens|bowl|zero-proof|sparkling water|unsweetened|cold brew|espresso|tea\b|black coffee/i

/** Whether an authored dish is marked NAS: plain savoury food and unsweetened drinks only. Anything sweet, glazed or sauced with sugar is left unmarked. */
export const isNas = (name: string): boolean => PLAIN.test(name) && !SWEET.test(name)

/** One dish for a pool: name, what it has, whether it has no added sugar, and a line on it. */
type P = [name: string, contains: Contains[], nas: boolean, note: string]

const STARTER: P[] = [
  ['Chilled Cucumber & Mint Gazpacho', [], true, 'A cool soup of cucumber, mint and lime. No cream and no added sugar.'],
  ['Roasted Beet & Citrus Salad', [], true, 'Roasted beets with orange segments and herbs, dressed in olive oil and lemon.'],
  ['Heirloom Tomato Bruschetta', ['gluten'], false, 'Grilled bread with marinated tomatoes, garlic and basil.'],
  ['Wild Mushroom Soup', ['dairy'], false, 'A velvety soup of wild mushrooms finished with a swirl of cream.'],
  ['Avocado & Mango Tartare', [], false, 'Diced avocado and ripe mango with lime and chilli, served with plantain crisps.'],
  ['Spiced Lentil & Spinach Soup', [], true, 'Red lentils and spinach with cumin and turmeric. Vegan and no added sugar.'],
  ['Stuffed Vine Leaves', [], false, 'Vine leaves filled with herbed rice, lemon and pine nuts.'],
  ['Grilled Asparagus with Lemon Zest', [], true, 'Chargrilled asparagus with lemon zest and sea salt.'],
  ['Caprese Skewers', ['dairy'], true, 'Mozzarella, tomato and basil with a drizzle of olive oil.'],
  ['Crispy Tofu Spring Rolls', ['gluten'], false, 'Vegetable and tofu rolls with a sweet chilli dip.'],
  ['Baked Brie with Cranberries', ['dairy', 'gluten'], false, 'Warm brie in pastry with cranberry compote.'],
  ['Mixed Greens with Citrus Vinaigrette', [], true, 'Baby leaves, shaved fennel and radish in a lemon vinaigrette.'],
]
const MAIN: P[] = [
  ['Roasted Cauliflower Steak with Chimichurri', [], true, 'A thick slice of cauliflower roasted until golden and served with a herb chimichurri.'],
  ['Chickpea & Spinach Curry', [], true, 'Chickpeas and spinach in a fragrant tomato and coconut sauce, with basmati rice. Vegan.'],
  ['Wild Mushroom Stroganoff', ['dairy', 'gluten'], false, 'Mushrooms in a paprika cream sauce over buttered noodles.'],
  ['Eggplant & Lentil Moussaka', [], false, 'Layers of aubergine, lentils and tomato under a plant-based béchamel.'],
  ['Spaghetti Pomodoro', ['gluten'], false, 'Spaghetti in a slow-simmered tomato and basil sauce. Vegan on request without cheese.'],
  ['Vegetable Paella', [], true, 'Saffron rice with peppers, artichokes, peas and green beans.'],
  ['Spinach & Ricotta Cannelloni', ['dairy', 'gluten', 'egg'], false, 'Pasta tubes filled with spinach and ricotta, baked in tomato sauce.'],
  ['Grilled Portobello Steak', [], true, 'A grilled portobello cap with roasted peppers and a garlic herb dressing.'],
  ['Thai Green Vegetable Curry', [], true, 'Seasonal vegetables and tofu in a green curry coconut sauce, with jasmine rice.'],
  ['Herb-Crusted Salmon', ['fish'], true, 'Salmon fillet with a herb crust, steamed greens and lemon.'],
  ['Slow-Roasted Chicken with Root Vegetables', ['meat'], true, 'Half a chicken roasted with thyme, carrots and parsnips.'],
  ['Paneer Tikka Masala', ['dairy'], false, 'Grilled paneer in a spiced tomato and cream sauce, with basmati rice.'],
  ['Butternut Squash Risotto', ['dairy'], false, 'Arborio rice slowly cooked with roasted squash, sage and parmesan.'],
  ['Teriyaki Tofu Rice Bowl', ['gluten'], false, 'Glazed tofu with rice, edamame and pickled vegetables.'],
]
const DESSERT: P[] = [
  ['Fresh Seasonal Fruit Plate', [], true, 'Sliced fresh fruit, naturally sweet. No added sugar.'],
  ['Dark Chocolate Avocado Mousse', [], false, 'A rich dairy-free mousse made with dark chocolate and ripe avocado.'],
  ['Coconut Rice Pudding', [], false, 'Rice cooked in coconut milk with vanilla and a hint of lime. Vegan.'],
  ['Baked Cinnamon Apple', [], true, 'A whole baked apple with cinnamon and raisins. No added sugar.'],
  ['Berry Sorbet Trio', [], false, 'Three scoops of fruit sorbet. Vegan.'],
  ['Sugar-Free Vanilla Panna Cotta', ['dairy'], true, 'Silky vanilla panna cotta sweetened with stevia, with fresh berries.'],
  ['No-Sugar-Added Baked Cheesecake', ['dairy', 'egg', 'gluten'], true, 'A classic baked cheesecake with no added sugar.'],
  ['Vegan Chocolate Brownie', ['gluten', 'nuts'], false, 'A fudgy brownie made without eggs or dairy, with walnuts.'],
  ['Lemon Olive Oil Cake', ['dairy', 'egg', 'gluten'], false, 'A moist cake of lemon and olive oil with a light glaze.'],
  ['Vegan Almond Cream Tart', ['gluten', 'nuts'], false, 'Crisp pastry filled with almond cream and fresh fruit. No dairy or egg.'],
  ['Strawberries with Vanilla Yoghurt', ['dairy'], true, 'Fresh strawberries with plain vanilla yoghurt.'],
  ['Sugar-Free Dark Chocolate Pot', ['dairy'], true, 'A small pot of dark chocolate cream sweetened without sugar.'],
]
const FAVOURITE: P[] = [
  ['Garden Salad with Balsamic Vinaigrette', [], true, 'Crisp leaves, tomato, cucumber and radish in balsamic vinaigrette. Vegan.'],
  ['Steamed Seasonal Vegetables', [], true, 'Lightly steamed vegetables with sea salt and olive oil.'],
  ['Baked Potato with Chives', ['dairy'], false, 'A fluffy baked potato with sour cream and chives.'],
  ['Plain Grilled Chicken Breast', ['meat'], true, 'Grilled chicken breast with lemon and herbs, nothing added.'],
  ['Vegetable Pasta Primavera', ['gluten'], false, 'Penne with spring vegetables in olive oil and garlic. Vegan.'],
  ['Mac & Cheese', ['dairy', 'gluten'], false, 'Macaroni in a creamy cheese sauce with a crisp crumb.'],
]
const BREAKFAST: P[] = [
  ['Steel-Cut Oatmeal with Fresh Berries', [], true, 'Warm oatmeal made with water and topped with berries. Vegan and no added sugar.'],
  ['Avocado Toast with Tomato', ['gluten'], false, 'Smashed avocado on toasted sourdough with tomato and chilli flakes. Vegan.'],
  ['Tofu Scramble with Peppers', [], true, 'Turmeric tofu scrambled with peppers and onion. Vegan.'],
  ['Greek Yoghurt with Fresh Fruit', ['dairy'], true, 'Plain Greek yoghurt with fresh seasonal fruit, no added sugar.'],
  ['Spinach & Cheese Omelet', ['egg', 'dairy'], true, 'A three-egg omelet with spinach and cheddar.'],
  ['Vegan Banana Pancakes', ['gluten'], false, 'Pancakes made with oat milk and banana, served with maple-free fruit compote.'],
  ['Sugar-Free Bran Muffin', ['gluten', 'egg', 'dairy'], true, 'A bran muffin sweetened with fruit, no sugar added.'],
  ['Poached Eggs on Wilted Greens', ['egg'], true, 'Two poached eggs on garlicky wilted spinach.'],
  ['Chia Pudding with Coconut', [], true, 'Chia seeds soaked in coconut milk, topped with fresh mango. Vegan.'],
  ['Mushroom & Tomato on Toast', ['gluten'], false, 'Sautéed mushrooms and grilled tomato on rye toast. Vegan.'],
]
const LUNCH: P[] = [
  ['Quinoa & Roasted Vegetable Bowl', [], true, 'Quinoa with roasted vegetables, chickpeas and a tahini-lemon dressing. Vegan.'],
  ['Falafel Wrap with Hummus', ['gluten'], false, 'Crisp falafel, salad and hummus in a warm flatbread. Vegan.'],
  ['Grilled Vegetable & Mozzarella Panini', ['dairy', 'gluten'], false, 'Peppers, courgette and mozzarella pressed in ciabatta.'],
  ['Greek Salad', ['dairy'], true, 'Tomato, cucumber, olives and feta with oregano and olive oil.'],
  ['Black Bean Burger', ['gluten'], false, 'A black bean and corn patty on a toasted bun with avocado. Vegan.'],
  ['Grilled Chicken & Avocado Salad', ['meat'], true, 'Grilled chicken, avocado and leaves with a lime dressing.'],
  ['Lentil & Vegetable Soup', [], true, 'A hearty lentil soup with carrots, celery and tomato. Vegan.'],
  ['Caprese Salad', ['dairy'], true, 'Mozzarella, tomato and basil with olive oil.'],
]
const SNACK: P[] = [
  ['Garden Veggie Wrap', ['gluten'], false, 'Crisp vegetables and hummus in a soft wrap. Vegan.'],
  ['Fresh Fruit Cup', [], true, 'A cup of fresh seasonal fruit. No added sugar.'],
  ['Cheese & Tomato Flatbread', ['dairy', 'gluten'], false, 'A thin flatbread with tomato and melted cheese.'],
  ['Hummus & Crudités', [], true, 'Hummus with carrot, cucumber and pepper sticks. Vegan.'],
  ['Side Salad', [], true, 'Mixed leaves with a lemon dressing. Vegan.'],
  ['Plain Yoghurt Cup', ['dairy'], true, 'Plain yoghurt with no added sugar.'],
  ['Roasted Almonds', ['nuts'], true, 'A small bowl of dry-roasted almonds. Vegan and no added sugar.'],
  ['Baked Sweet Potato Wedges', [], false, 'Oven-baked sweet potato wedges with smoked paprika. Vegan.'],
]
const DRINK: P[] = [
  ['No-Jito (zero-proof mojito)', [], false, 'Muddled mint, lime and soda. Vegan.'],
  ['Sparkling Water with Citrus', [], true, 'Chilled sparkling water with fresh lemon and lime. No added sugar.'],
  ['Unsweetened Iced Tea', [], true, 'Freshly brewed tea over ice. No added sugar.'],
  ['Cold Brew Black Coffee', [], true, 'Slow-steeped cold brew, served black. No added sugar.'],
  ['Oat Milk Flat White', [], false, 'Espresso with steamed oat milk. Vegan.'],
  ['Matcha Latte', ['dairy'], false, 'Ceremonial matcha with steamed milk.'],
  ['Cappuccino', ['dairy'], true, 'Espresso with steamed and foamed milk, no sugar added.'],
  ['Strawberry Basil Spritzer (zero-proof)', [], false, 'Strawberry, basil and soda water. Vegan.'],
]

type Kind = 'starter' | 'main' | 'dessert' | 'favourite' | 'breakfast' | 'lunch' | 'snack' | 'drink'
const POOLS: Record<Kind, P[]> = { starter: STARTER, main: MAIN, dessert: DESSERT, favourite: FAVOURITE, breakfast: BREAKFAST, lunch: LUNCH, snack: SNACK, drink: DRINK }

const hash = (s: string): number => { let h = 5381; for (const ch of s) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0; return h }

/** What a section of a menu is, from its name. */
export function kindOf(course: string, meal: string): Kind {
  if (/starter|soup|appetis|appetiz/i.test(course)) return 'starter'
  if (/entr|main/i.test(course)) return 'main'
  if (/dessert|sweet/i.test(course)) return 'dessert'
  if (/favou?rite/i.test(course)) return 'favourite'
  if (/signature|drink/i.test(course)) return 'drink'
  if (meal === 'breakfast') return 'breakfast'
  if (meal === 'lunch') return 'lunch'
  return /station|tonight/i.test(course) ? 'main' : 'snack'
}

const toDish = ([name, contains, nas, note]: P): MenuDish => ({ name, contains: [...contains].sort(), note, marks: marksOf(name, contains, nas) })

/** Marks the dishes of a section, then adds from its pool until it has a vegan, a vegetarian and a NAS dish and a wider choice (`extra` more). The pick turns with `seed`, so each night and room differs. */
export function fillSection(course: MenuCourse, kind: Kind, seed: string, extra = 1): MenuCourse {
  // A drink already on the list is never marked (wine and spirits can be fined or made with animal products); only the pool's zero-proof drinks are.
  const dishes: MenuDish[] = course.dishes.map((d) => ({ ...d, marks: kind === 'drink' ? [] : marksOf(d.name, d.contains, isNas(d.name)) }))
  const have = (m: Mark, only = false) => dishes.some((d) => d.marks?.includes(m) && (!only || !d.marks.includes('vegan')))
  const used = new Set(dishes.map((d) => d.name))
  const pool = POOLS[kind]
  const start = hash(seed) % pool.length
  const take = (fits: (d: MenuDish) => boolean): void => {
    for (let i = 0; i < pool.length; i++) {
      const d = toDish(pool[(start + i) % pool.length])
      if (!used.has(d.name) && fits(d)) { used.add(d.name); dishes.push(d); return }
    }
  }
  if (!have('vegan')) take((d) => d.marks?.includes('vegan') === true)
  if (!have('vegetarian')) take((d) => d.marks?.includes('vegetarian') === true)
  if (!have('nas')) take((d) => d.marks?.includes('nas') === true)
  for (let i = 0; i < extra; i++) take(() => true)
  return { name: course.name, dishes }
}

/** A standing menu's one flat list split into Starters, Mains and Desserts by what each dish is called. */
export function sectionsOf(dishes: readonly MenuDish[]): MenuCourse[] {
  const dessert = /tart\b|cake|souffl|tiramisu|sorbet|pudding|ice cream|mousse|brûlée|brulee|cheesecake|mochi|cookie|pie\b|soft-serve|swirl|churro|milkshake|sundae|danish|croissant|muffin|biscotti|pastry|fruit and pastry|cone\b|fondant|sphere/i
  const starter = /soup|salad|bisque|carpaccio|cocktail|tartare|crudo|burrata|edamame|miso|bao|spring roll|chowder|bites|pretzel|dip\b|arancini|calamari|toast|panzanella|greens|sticks|fries|slice|raw bar|oyster/i
  const out: Record<'Starters' | 'Mains' | 'Desserts', MenuDish[]> = { Starters: [], Mains: [], Desserts: [] }
  for (const d of dishes) (dessert.test(d.name) ? out.Desserts : starter.test(d.name) ? out.Starters : out.Mains).push(d)
  return (Object.entries(out) as [string, MenuDish[]][]).filter(([, l]) => l.length > 0).map(([name, l]) => ({ name, dishes: l }))
}
