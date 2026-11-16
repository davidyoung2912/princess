// The second pass at the 7-day schedule (docs/princess-special-events.md, princess-activities.md, princess-entertainment.md): the smaller one-off events a real sailing has. Daytime games and
// quizzes in the lounges and bars that are quiet by day, Piazza acts and demonstrations, tastings and classes, family and teen events, and the pop-up sales. Authored concept content: start
// times and lengths are chosen here for review, like the rest of the Explorer. One table is shared by the three ships; each ship maps a role (`lounge`, `pub`, `coffee`...) to its own room.
import type { ExplorerEventRow } from './ship-explorer-data.ts'

type Role =
  | 'lounge' | 'live' | 'piazza' | 'pool' | 'theater' | 'pub' | 'crooners' | 'bellinis' | 'spirits' | 'wine' | 'coffee' | 'poolbar' | 'aftbar' | 'cards' | 'workshop' | 'talks' | 'meet'
  | 'deck' | 'teens' | 'camp' | 'eatery' | 'lido' | 'cafe' | 'main' | 'pizza' | 'spa' | 'gym' | 'studio' | 'court' | 'popPiazza' | 'popPool' | 'gallery' | 'casino'

/** Each ship's room for a role (ids as in ship-explorer.json). A role a ship has no room for is skipped on that ship. */
const ROLES: Record<string, Partial<Record<Role, string>>> = {
  'sun-princess': { lounge: 'live', live: 'live', piazza: 'piazza', pool: 'seaview', theater: 'arena', pub: 'live-omalleys', crooners: 'crooners-bar', bellinis: 'bellinis', spirits: 'good-spirits', wine: 'wheelhouse',
    coffee: 'coffee', poolbar: 'sea-view-bar', aftbar: 'wake-view-bar', cards: 'act-library', workshop: 'act-workshop', talks: 'act-talks', meet: 'act-meet', deck: 'act-deck', teens: 'act-teens', camp: 'act-camp',
    eatery: 'eatery', lido: 'lido', cafe: 'intl-cafe', main: 'eclipse', pizza: 'alfredo', spa: 'lotus', gym: 'fit-gym', studio: 'fit-studio', court: 'fit-court', popPiazza: 'shop-piazza', popPool: 'shop-pool', gallery: 'shop-gallery', casino: 'casino' },
  'sky-princess': { lounge: 'sky-vista', live: 'sky-live', piazza: 'sky-piazza', pool: 'sky-pool', theater: 'sky-theater', pub: 'sky-omalleys', crooners: 'sky-crooners', bellinis: 'sky-bellinis', spirits: 'sky-good-spirits', wine: 'sky-vines',
    coffee: 'sky-coffee', poolbar: 'sky-mermaids-tail', aftbar: 'sky-wake-view-bar', cards: 'sky-act-library', workshop: 'sky-act-workshop', talks: 'sky-act-talks', meet: 'sky-act-meet', deck: 'sky-act-deck', teens: 'sky-act-teens', camp: 'sky-act-camp',
    eatery: 'sky-eatery', lido: 'sky-lido', cafe: 'sky-intl-cafe', main: 'sky-cielo', pizza: 'sky-alfredo', spa: 'sky-lotus', gym: 'sky-fit-gym', studio: 'sky-fit-studio', court: 'sky-fit-court', popPiazza: 'sky-shop-piazza', popPool: 'sky-shop-pool', gallery: 'sky-shop-gallery', casino: 'sky-casino' },
  'sapphire-princess': { lounge: 'sapphire-explorers', live: 'sapphire-fusion', piazza: 'sapphire-piazza', pool: 'sapphire-pool', theater: 'sapphire-theater', pub: 'sapphire-salty-dog-gastropub', crooners: 'sapphire-crooners', bellinis: 'sapphire-vines',
    spirits: 'sapphire-wheelhouse', wine: 'sapphire-vines', coffee: 'sapphire-coffee', poolbar: 'sapphire-calypso-bar', aftbar: 'sapphire-wake-view-bar', cards: 'sapphire-act-library', workshop: 'sapphire-act-workshop', talks: 'sapphire-act-talks',
    meet: 'sapphire-act-meet', deck: 'sapphire-act-deck', teens: 'sapphire-act-teens', camp: 'sapphire-act-camp', eatery: 'sapphire-eatery', lido: 'sapphire-lido', cafe: 'sapphire-intl-cafe', main: 'sapphire-santa-fe', pizza: 'sapphire-alfredo',
    spa: 'sapphire-lotus', gym: 'sapphire-fit-gym', studio: 'sapphire-fit-studio', court: 'sapphire-fit-court', popPiazza: 'sapphire-shop-piazza', popPool: 'sapphire-shop-pool', gallery: 'sapphire-shop-gallery', casino: 'sapphire-casino' },
}

type Age = ExplorerEventRow['age']
interface Opt { age?: Age; extra?: number; capacity?: number }
/** slug, role, day kinds, start, minutes, interest, title, detail, options. */
type T = [string, Role, string[], string, number, string, string, string, Opt?]


const TABLE: T[] = [
  // ---- Games, quizzes and trivia in the lounges that are quiet by day
  ['bingo-main', 'lounge', ['firstSea', 'laterSea'], '14:00', 60, 'games', 'Bingo: six games and a jackpot', 'Cards are on sale at the door; six regular games and a final jackpot round. Prizes for the lucky.', { extra: 1500 }],
  ['bingo-jackpot', 'lounge', ['lastPort', 'portEven'], '16:00', 60, 'games', 'Jackpot bingo', 'A bigger prize pot for the last games of the afternoon. Cards are sold at the door.', { extra: 2500 }],
  ['bingo-family', 'lounge', ['seaMid'], '11:00', 45, 'family', 'Family bingo', 'A friendly round of bingo for all ages with small prizes. Children play free with a paying adult.', { age: 'all' }],
  ['quiz-80s', 'lounge', ['firstSea'], '15:30', 45, 'games', '80s music quiz', 'Name the band, finish the lyric and guess the year from a snatch of chart-topping hits.', { age: 'all' }],
  ['quiz-90s', 'lounge', ['laterSea'], '15:30', 45, 'games', '90s and 2000s music quiz', 'Teams name the song from the first few seconds. Play along solo or in a group.', { age: 'all' }],
  ['quiz-name-tune', 'lounge', ['portEven'], '16:30', 45, 'games', 'Name that tune', 'The band plays a few bars; the first team to shout the title scores.', { age: 'all' }],
  ['quiz-movie', 'lounge', ['earlyPortOdd'], '16:30', 45, 'games', 'Movie quotes and film trivia', 'Which film is that line from? A quiz for fans of the screen, big and small.', { age: 'all' }],
  ['quiz-sports', 'lounge', ['lastPort'], '16:30', 45, 'games', 'Sports trivia', 'Teams of up to six answer questions on the games and the players.', { age: 'all' }],
  ['quiz-geography', 'lounge', ['seaMid'], '09:30', 40, 'games', 'Geography and world capitals quiz', 'A gentle morning quiz that ends with a few questions about the ports ahead.', { age: 'all' }],
  ['quiz-brain', 'lounge', ['laterSea'], '10:00', 40, 'games', 'Brain teasers, riddles and logic puzzles', 'Work out the puzzle before the host reveals the answer.', { age: 'all' }],
  ['quiz-pub', 'pub', ['sea'], '14:30', 60, 'games', 'Pub quiz', 'Six rounds of general-knowledge questions with a pint (or a soda) in hand.', { age: 'adults' }],
  ['quiz-coffee', 'coffee', ['sea'], '10:30', 45, 'games', 'Coffee house trivia', 'A relaxed morning quiz over a coffee and a pastry. Teams of up to four.', { age: 'all' }],
  ['game-newlywed', 'live', ['firstSea'], '16:00', 45, 'games', 'The newlywed, not-so-newlywed game', 'Couples answer questions about each other for the audience’s amusement. Volunteers wanted at the door.', { age: 'adults' }],
  ['game-lipsync', 'live', ['laterSea'], '21:00', 60, 'nightlife', 'Lip sync battle', 'Guests and crew mime to their favourite hits. Sign up with the host before the show.', { age: 'adults' }],
  ['game-scattergories', 'lounge', ['portOdd'], '16:00', 45, 'games', 'Word games: scattergories and charades', 'Team word games for the afternoon after a morning ashore.', { age: 'all' }],
  ['game-trivia-night', 'live', ['firstSea', 'laterSea'], '20:00', 50, 'games', 'Team trivia night', 'The evening trivia with a theme: music one night, film and television the next.', { age: 'adults' }],

  // ---- Music and karaoke by day and at night
  ['karaoke-pub', 'pub', ['seaMid'], '15:30', 60, 'music', 'Karaoke in the pub', 'Pick a song and sing it. The host has a book of thousands.', { age: 'adults' }],
  ['karaoke-crooners', 'crooners', ['laterSea', 'portEven'], '15:00', 60, 'music', 'Afternoon piano sing-along', 'The pianist plays requests from the crowd and the room joins in.', { age: 'adults' }],
  ['karaoke-live', 'live', ['firstSea'], '21:15', 75, 'nightlife', 'Karaoke night', 'Take the stage in the TV studio lounge. Sign up with the host.', { age: 'adults' }],
  ['openmic', 'lounge', ['seaMid'], '19:30', 60, 'music', 'Passenger talent show: open mic', 'Singers, comedians and musicians have five minutes each. Sign up at the door.', { age: 'all' }],
  ['piano-happy', 'crooners', ['night'], '17:00', 60, 'music', 'Piano bar happy hour', 'Early-evening martini specials and standards from the resident pianist.', { age: 'adults' }],
  ['bar-vinyl', 'aftbar', ['sea'], '16:30', 60, 'music', 'Sunset vinyl set at the stern bar', 'A DJ plays soul and classic rock on vinyl as the sun goes down over the wake.', { age: 'adults' }],
  ['lounge-latin', 'live', ['portOdd'], '21:30', 75, 'nightlife', 'Latin night', 'Salsa, bachata and merengue with a lesson at the start of the night.', { age: 'adults' }],
  ['lounge-country', 'live', ['portEven'], '21:30', 75, 'nightlife', 'Country hits and line dancing', 'A line-dance lesson, then the dance floor is yours.', { age: 'adults' }],
  ['dance-80s', 'piazza', ['laterSea'], '21:30', 75, 'nightlife', '80s dance party', 'The resident band and the DJ play the decade’s dance floor fillers.', { age: 'adults' }],
  ['dance-glow', 'pool', ['firstSea'], '22:00', 75, 'nightlife', 'Glow party on deck', 'Neon face paint, glow sticks and a DJ under the stars. Weather permitting.', { age: 'adults' }],
  ['dance-white', 'pool', ['laterSea'], '21:30', 75, 'nightlife', 'White party', 'Wear white and dance by the pool. Weather permitting.', { age: 'adults' }],
  ['piazza-sing', 'piazza', ['seaMid'], '12:00', 45, 'music', 'Piazza sing-along lunchtime', 'The pianist leads the room in the songs everyone knows. Come with your lunch.', { age: 'all' }],
  ['piazza-quartet', 'piazza', ['laterSea'], '16:30', 45, 'music', 'Afternoon tea and string quartet', 'Light music over a cup of tea and a pastry on the Piazza.', { age: 'all' }],
  ['piazza-latin', 'piazza', ['port'], '18:45', 45, 'music', 'Latin guitar at sailaway', 'Gentle guitar as the ship leaves port.', { age: 'all' }],
  ['piazza-juggle', 'piazza', ['seaMid'], '15:00', 30, 'shows', 'Piazza street performers', 'Jugglers, stilt walkers and a unicyclist circle the atrium.', { age: 'all' }],
  ['piazza-magic', 'piazza', ['firstSea'], '15:00', 30, 'shows', 'Close-up magic on the Piazza', 'A magician works the crowd with cards and coins. Free and no seat needed.', { age: 'all' }],
  ['piazza-dance', 'piazza', ['laterSea'], '10:30', 45, 'wellness', 'Line dance and Latin dance class', 'Learn the steps and join the afternoon party. No partner needed.', { age: 'all' }],

  // ---- Talks and demonstrations
  ['demo-towel', 'piazza', ['seaMid'], '11:00', 30, 'learning', 'Towel animal folding', 'The cabin stewards show how to fold an elephant, a swan and a monkey. Take a towel home.', { age: 'all' }],
  ['demo-ice', 'piazza', ['laterSea'], '14:00', 30, 'learning', 'Ice carving demonstration', 'A chef sculpts a block of ice into a swan in half an hour.', { age: 'all' }],
  ['demo-galley', 'eatery', ['seaMid'], '10:30', 45, 'learning', 'Behind-the-scenes galley tour', 'A guided walk through the galley, with a look at how the ship feeds thousands in an evening. Limited places.', { age: 'all', capacity: 20 }],
  ['talk-photo', 'talks', ['laterSea'], '10:00', 40, 'learning', 'Photography at sea: sunrise, sunset and wildlife', 'Tips for better photographs from a deck, with time for questions.', { age: 'all' }],
  ['talk-future', 'talks', ['port'], '09:30', 30, 'learning', 'Future cruise planning and loyalty benefits', 'How to book your next cruise on board and what the loyalty tiers include.', { age: 'all' }],
  ['talk-wellness', 'spa', ['seaMid'], '12:00', 40, 'wellness', 'Wellness seminar: sleep and stress', 'A spa expert shares practical ways to rest better on board and at home.', { age: 'adults' }],

  // ---- Food and drink: classes, tastings and the sweet and savoury extras
  ['cocktail-class', 'spirits', ['seaMid'], '11:30', 45, 'food', 'Mixology class: three signature cocktails', 'The bartender shows how to shake, stir and garnish three drinks you can make at home. Tastings included.', { age: 'adults', extra: 2500, capacity: 16 }],
  ['mocktail-class', 'spirits', ['laterSea'], '11:30', 45, 'food', 'Zero-proof mocktail masterclass', 'Build three alcohol-free drinks with fresh juice, herbs and syrups.', { age: 'all', capacity: 16 }],
  ['beer-tasting', 'pub', ['firstSea'], '15:00', 45, 'food', 'Craft beer and cider tasting', 'Five pours of regional beers and ciders with a short talk on each.', { age: 'adults', extra: 2000, capacity: 20 }],
  ['whiskey-flight', 'wine', ['portEven'], '16:30', 45, 'food', 'Whiskey flight tasting', 'Three whiskeys from three countries with a bar host to guide you.', { age: 'adults', extra: 2500, capacity: 16 }],
  ['rum-tasting', 'poolbar', ['laterSea'], '14:00', 45, 'food', 'Caribbean rum tasting', 'Four rums from the islands, with a short history of each.', { age: 'adults', extra: 2000, capacity: 20 }],
  ['champagne-brunch', 'bellinis', ['seaMid'], '11:00', 60, 'food', 'Sparkling brunch tasting', 'Three sparkling wines paired with small brunch plates.', { age: 'adults', extra: 3000, capacity: 20 }],
  ['coffee-tasting', 'coffee', ['laterSea'], '10:00', 40, 'food', 'Coffee tasting and latte art', 'Taste three single-origin coffees and watch the barista pour a heart.', { age: 'all', capacity: 16 }],
  ['icecream-social', 'lido', ['seaMid'], '15:30', 45, 'food', 'Ice cream social', 'Build a sundae with the toppings of your choice. Free with your fare.', { age: 'all' }],
  ['chocolate-tasting', 'cafe', ['laterSea'], '16:00', 40, 'food', 'Chocolate tasting', 'Four chocolates from dark to milk, with notes on where the cacao grew.', { age: 'all', capacity: 24 }],
  ['sushi-class', 'eatery', ['laterSea'], '10:30', 60, 'food', 'Sushi rolling class', 'Roll your own maki with a chef, then eat your work. A vegetarian filling is available.', { age: 'all', extra: 2500, capacity: 16 }],
  ['pasta-class', 'eatery', ['firstSea'], '10:30', 60, 'food', 'Fresh pasta making class', 'Learn to roll and cut fresh pasta and make a simple sauce.', { age: 'all', extra: 2500, capacity: 16 }],
  ['pizza-class', 'pizza', ['laterSea'], '14:30', 45, 'food', 'Pizza making demonstration', 'The pizza chef shows how to stretch dough and build a pie. Tastes for everyone.', { age: 'all' }],
  ['bbq-lido', 'lido', ['firstSea'], '12:00', 120, 'food', 'Poolside barbecue lunch', 'Grilled meats, fish, vegetables and salads on the pool deck, with a band. Weather permitting.', { age: 'all' }],
  ['brunch-sea', 'eatery', ['laterSea'], '10:00', 120, 'food', 'Sea day brunch', 'A long brunch with breakfast and lunch dishes, a carving station and a dessert table.', { age: 'all' }],
  ['dessert-parade', 'eatery', ['firstSea'], '21:30', 45, 'food', 'Dessert parade', 'The pastry team brings out a table of cakes, tarts and sorbets. Many are made without gluten or sugar.', { age: 'all' }],
  ['choc-buffet', 'eatery', ['laterSea'], '21:00', 60, 'food', 'Late-night chocolate buffet', 'A late-night spread of cakes, truffles, fountains and fruit.', { age: 'all' }],
  ['crab-night', 'eatery', ['laterSea'], '18:30', 120, 'food', 'Pool deck seafood night', 'Shrimp, crab legs and grilled fish on the Lido. Weather permitting.', { age: 'all' }],

  // ---- Craft, hobby and quiet
  ['craft-card', 'workshop', ['seaMid'], '11:30', 45, 'learning', 'Card making and scrapbooking', 'Make a card to send home, with all the paper and stickers on the table.', { age: 'all' }],
  ['craft-jewelry', 'workshop', ['laterSea'], '10:30', 45, 'learning', 'Beaded bracelet workshop', 'String a bracelet of your own design. Materials included.', { age: 'all' }],
  ['craft-paint', 'workshop', ['firstSea'], '15:00', 60, 'learning', 'Paint and sip', 'A guided painting of the sunset with a drink at your elbow.', { age: 'adults', extra: 2000, capacity: 20 }],
  ['game-jigsaw', 'cards', ['sea'], '09:30', 120, 'games', 'Jigsaw puzzle table', 'A big puzzle sits on the table all morning. Add a few pieces.', { age: 'all' }],
  ['game-sudoku', 'cards', ['seaMid'], '10:30', 45, 'games', 'Crossword and sudoku club', 'Solve the day’s puzzles together or swap tips.', { age: 'all' }],
  ['game-poker', 'cards', ['laterSea'], '15:30', 60, 'games', 'Social Texas Hold’em for beginners', 'Learn the rules at a friendly table. No money on the table.', { age: 'adults' }],
  ['meet-photo', 'meet', ['laterSea'], '16:30', 45, 'community', 'Photography enthusiasts meet-up', 'Share the shots you took in port and swap tips on the next ones.', { age: 'all' }],
  ['meet-golf', 'meet', ['seaMid'], '16:30', 45, 'community', 'Golfers’ get-together', 'Meet other golfers and swap stories of the courses at the next ports.', { age: 'all' }],
  ['meet-first', 'meet', ['firstSea'], '16:30', 45, 'community', 'First-time cruisers’ meet-up', 'Ask questions of a host and meet others new to the ship.', { age: 'all' }],
  ['meet-birthday', 'meet', ['seaMid'], '17:30', 30, 'community', 'Anniversary and birthday celebration', 'A drink on the ship for guests marking an occasion.', { age: 'all' }],
  ['deck-sunrise', 'deck', ['sea'], '06:15', 45, 'wellness', 'Sunrise on the open deck', 'Quiet coffee at the rail as the day begins, with the naturalist on hand to point things out.', { age: 'all' }],
  ['deck-bird', 'deck', ['port'], '07:00', 45, 'learning', 'Seabird and dolphin watch', 'Binoculars and a guide on the open deck as the ship leaves or enters harbour.', { age: 'all' }],

  // ---- Wellness and exercise
  ['fit-stretch-sail', 'studio', ['port'], '17:00', 30, 'wellness', 'Sailaway stretch', 'A short stretch to unwind after a day ashore.', { age: 'all' }],
  ['fit-meditation', 'studio', ['seaMid'], '17:30', 30, 'wellness', 'Guided meditation', 'A calm half hour of breathing and a body scan. Mats provided.', { age: 'all' }],
  ['fit-aqua', 'pool', ['laterSea'], '11:00', 40, 'wellness', 'Aqua aerobics', 'A low-impact workout in the pool with music.', { age: 'all' }],
  ['fit-dodge', 'court', ['firstSea'], '15:00', 45, 'games', 'Dodgeball and the 4-square game', 'A teams-of-six knockout for all comers. Soft balls only.', { age: 'all' }],
  ['fit-tour', 'gym', ['laterSea'], '08:30', 30, 'wellness', 'Gym orientation and equipment tour', 'A trainer shows the machines and the free-weight area and answers questions.', { age: 'all' }],

  // ---- Family, kids and teens
  ['kids-scavenger', 'camp', ['laterSea'], '14:00', 60, 'family', 'Ship scavenger hunt for kids', 'Teams of children follow clues around the ship, led by a counselor.', { age: 'kids' }],
  ['kids-cookie', 'camp', ['seaMid'], '15:30', 45, 'family', 'Cookie decorating', 'Decorate a cookie and eat it. Allergy-friendly icing available.', { age: 'kids' }],
  ['kids-karaoke', 'camp', ['portOdd'], '19:00', 45, 'family', 'Kids’ karaoke', 'Little singers take the microphone. Parents welcome to listen.', { age: 'kids' }],
  ['kids-magic', 'camp', ['firstSea'], '15:00', 40, 'family', 'Magic show for kids', 'Tricks, balloons and a lot of laughing with the youth team.', { age: 'kids' }],
  ['family-trivia', 'lounge', ['firstSea'], '17:00', 40, 'family', 'Family trivia', 'Teams of all ages answer questions on animals, music and space.', { age: 'all' }],
  ['family-movie-day', 'pool', ['seaMid'], '14:00', 100, 'family', 'Afternoon family film by the pool', 'A film on the big screen with popcorn. Bring a hat.', { age: 'all' }],
  ['teen-trivia', 'teens', ['laterSea'], '15:00', 45, 'games', 'Teen trivia challenge', 'Pop culture, games and music questions for the 13-to-17s.', { age: 'teens' }],
  ['teen-karaoke', 'teens', ['firstSea'], '19:00', 60, 'music', 'Teen karaoke', 'Take the mic or cheer from the sofa.', { age: 'teens' }],
  ['teen-mocktail', 'teens', ['seaMid'], '16:30', 40, 'food', 'Teen mocktail workshop', 'Mix and name your own alcohol-free drink.', { age: 'teens' }],
  ['teen-pool-party', 'pool', ['laterSea'], '15:00', 60, 'family', 'Teen pool party', 'Music, games and a floating obstacle course for 13 to 17s.', { age: 'teens' }],

  // ---- Pop-up sales, the pop-up tables and a few specials
  ['pop-future', 'popPiazza', ['firstSea', 'laterSea'], '11:00', 120, 'community', 'Future cruise sales pop-up', 'Ask about next year’s sailings, loyalty benefits and onboard booking offers. No obligation.', { age: 'all' }],
  ['pop-candy', 'popPiazza', ['seaMid'], '14:30', 90, 'food', 'Sweets and candy pop-up table', 'Boxed chocolates, hard candies and sugar-free treats at a table on the Piazza.', { age: 'all' }],
  ['pop-perfume', 'popPiazza', ['seaMid'], '18:00', 90, 'community', 'Fragrance and skincare pop-up', 'Sample fragrances and creams at the Piazza table, with a gift for any purchase.', { age: 'all' }],
  ['pop-watch', 'popPiazza', ['laterSea'], '17:00', 90, 'community', 'Watch and jewellery sidewalk sale', 'Tables of watches and jewellery marked down for the evening.', { age: 'all' }],
  ['pop-pool-hats', 'popPool', ['laterSea'], '15:30', 90, 'community', 'Sunscreen, hats and beach gear pop-up', 'Last-minute beach gear on a table by the pool.', { age: 'all' }],
  ['pop-art-auc', 'gallery', ['seaMid'], '16:00', 60, 'community', 'Art preview and champagne reception', 'Preview the pieces in the gallery before the auction, with a glass of sparkling wine.', { age: 'adults' }],
  ['pop-photo', 'popPiazza', ['firstSea'], '17:00', 120, 'community', 'Portrait and family photo pop-up', 'A photographer sets up a backdrop on the Piazza; no booking needed.', { age: 'all' }],
  ['pop-spa', 'popPiazza', ['laterSea'], '10:30', 90, 'wellness', 'Spa product pop-up and giveaway', 'Skincare samples and a raffle for a spa treatment.', { age: 'adults' }],
  ['pop-casino', 'casino', ['laterSea'], '11:00', 60, 'games', 'Learn to play: blackjack and roulette', 'A dealer walks through the rules at an open table. Chips are on the house.', { age: 'adults' }],
]

/** The events of this second pass for a ship, with that ship's rooms. */
export function extraEvents(shipId: string, prefix: string): ExplorerEventRow[] {
  const rooms = ROLES[shipId] ?? {}
  const out: ExplorerEventRow[] = []
  for (const [slug, role, when, start, minutes, interest, title, detail, o = {}] of TABLE) {
    const venueId = rooms[role]
    if (!venueId) continue
    out.push({ id: `${prefix}x-${slug}`, venueId, when, start, minutes, title, detail, age: o.age ?? 'all', interest, extra: o.extra ?? 0, ...(o.capacity ? { capacity: o.capacity } : {}) })
  }
  return out
}
