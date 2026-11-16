// What each event is, in a sentence or two, for the cards and venue pages. Authored concept content, matched on the title (the first rule that matches), so
// the many variants of one kind of event (an early and a late showing, a pop-up on each ship) read the same way. A rule may make its words from the title.
type Rule = readonly [RegExp, string | ((m: RegExpMatchArray) => string)]

const RULES: readonly Rule[] = [
  // Shows and productions
  [/^Production show: (.+?)(?:, (?:early|late) showing)?$/i, (m) => `The ship’s company performs ${m[1]}, a full production with singers, dancers and a live band. Choose the early or the late showing, whichever suits your dinner.`],
  [/^(?:Magic parlour seating)/i, 'A close-up evening of illusions in an intimate parlour where the magician performs a few feet from your seat. Seats are limited, so each seating is booked ahead.'],
  [/^Cirque Éloize/i, 'Cirque Éloize brings acrobatics, aerial artistry and music together under the dome. A show for the whole family.'],
  [/^5-SKIES/i, 'A virtual-reality-inspired musical with dazzling projections, big voices and high-energy dance numbers.'],
  [/^The Voice of the Ocean/i, 'Guests take the stage to compete for the title, backed by the band and the cheers of the crowd.'],
  [/^Headline guest (?:illusionist|vocalist)/i, 'A headline guest artist takes the main stage for an evening of showmanship, from the first note or trick to the curtain call.'],
  [/^Welcome aboard (?:variety|showtime|showcase)/i, 'Meet the entertainers who will be on board with you this week: a comedian and a vocalist, with a variety act in between.'],
  [/^Farewell (?:variety|jazz gala)/i, 'A last night of music and laughter, with the week’s favourite performers back on stage one more time.'],
  [/^Headline guest vocalist or instrumental virtuoso/i, 'A guest artist performs a solo set of favourites, from classics to chart hits.'],
  [/^Passenger (?:choir|dance) /i, 'Fellow guests who have rehearsed all week take the stage for a showcase. Come and cheer them on.'],
  [/^Choir at Sea and ukulele showcase/i, 'The choir and the ukulele class perform for fellow guests after a week of practice.'],
  [/^Pop-up (?:acrobat|aerialist|variety)/i, 'A surprise showcase of acrobats and variety artists, performed right where the crowd is.'],
  [/^Guest comedian and magician/i, 'A stand-up comedian and a magician share the stage for a fast, funny hour.'],
  [/^(?:Late-night )?(?:adult )?(?:stand-up )?comedy|^Late-night (?:adult )?stand-up|^Late-night improv|^Adult comedy/i, 'An adults-only late set of stand-up and quick-witted comedy. Expect some strong language.'],
  [/^Liar’s Club/i, 'A comedy game show where a panel makes up definitions and you guess which one is true.'],
  [/^Musical charades/i, 'Teams act out song titles in a loud and silly game show with prizes.'],
  [/^Rat Pack piano/i, 'An evening of Sinatra-era standards at the piano, with a martini to match. Requests welcome.'],
  [/^The Marriage Match|^Majority Rules|^Yes\/No|^Deal or No Deal|game show/i, 'An interactive game show hosted by the cruise staff, with volunteers, prizes and a lot of laughs.'],
  // Music
  [/Captain’s Welcome Champagne Waterfall/i, 'The captain welcomes you aboard with a tower of champagne and a toast, with live music in the atrium. Dress up if you like.'],
  [/karaoke/i, 'Sing your favourite, or cheer on others, with a live band or DJ and a screen full of lyrics.'],
  [/^Sailaway (?:deck party|celebration)/i, 'A party on deck as the ship sails away, with a live band, the cruise staff and a drink in your hand.'],
  [/duty-free liquor/i, 'Your last chance to order duty-free liquor for delivery to your cabin before you leave the ship.'],
  [/violin and cello duo|string trio|string quartet|harp and flute|violin and piano|harp and violin|classical guitar|classical crossover|classical string|violin duo/i, 'Live classical music played for the pleasure of it. A calm way to start or end the day.'],
  [/piano (?:sing-along|and slow dancing)|(?:Final night|Farewell) piano|request piano/i, 'Live piano with songs everybody knows. Sing along, dance a little, or just listen.'],
  [/piano and pastries|coffee and classical piano|morning piano|piano and violin/i, 'Gentle live piano with coffee and pastries close by.'],
  [/^Live Celtic|^Live Irish|^Last-night farewell sing-along|folk and pub|whiskey tasting/i, 'Live folk and pub songs, played to be sung along to. Bring a friend and a favourite chorus.'],
  [/rock and pop anthems|rock and pop/i, 'A live band plays the rock and pop anthems everyone knows, late into the evening.'],
  [/jazz trio|jazz and pop duo|cool jazz|jazz jam|Night in Harlem|Big Band and BeBop|women of jazz|jazz gala|jazz set|Afro-Cuban jazz|blues and jazz|Classic blues/i, 'Live jazz from the ship’s musicians, played for listening and for a slow dance.'],
  [/acoustic|guitarist|guitar and (?:coffee|vocalist)|guitar and espresso|vocalist/i, 'Relaxed live acoustic music with easy melodies. Find a seat and unwind.'],
  [/reggae|Caribbean band|party band|poolside band|poolside music|Relaxed afternoon poolside/i, 'A live band plays feel-good music beside the pool. Bring your drink and your dancing shoes.'],
  [/ballroom and (?:easy listening|swing)|ballroom and swing band|Live ballroom/i, 'A live band plays ballroom standards, with room to dance and a few steps to learn.'],
  [/Country and western|hoe-down/i, 'A live band plays country and western favourites, and the dance floor is open to everybody.'],
  [/Princess Pop Star/i, 'Guests sing for fun and for a prize in the ship’s own singing competition, with the crowd as judges.'],
  [/concert screening|concert under the stars|Afternoon concert/i, 'A concert on the big screen, with deck chairs and a fresh drink.'],
  [/Sunset acoustic|Sunset guitar/i, 'Soft live acoustic music as the sun goes down.'],
  [/Balloon drop|balloon drop/i, 'A gala party with a live band, dancing and a balloon drop at the stroke of the hour.'],
  [/\bdisco\b|Disco Inferno|DJ dance party|DJ kickoff|DJ and neon|clubbing|DJ lounge|Sunbathing and poolside DJ|poolside DJ/i, 'A DJ spins the beat and the dance floor does the rest. Come for one song or stay all night.'],
  [/Water and Light fountain/i, 'A fountain show of water, light and music in the evening, followed by a movie under the stars.'],
  // Movies
  [/Movies Under the Stars|blockbuster|feature film|Afternoon movie|Afternoon feature/i, 'A film on the big outdoor screen, with a deck chair and popcorn. Bring a blanket if the evening is cool.'],
  // Games and learning
  [/trivia|brainteasers|crossword|Wake Show/i, 'Teams compete for bragging rights in the ship’s trivia, hosted by the cruise staff. No experience needed, just a team and a sense of humour.'],
  [/bingo|lotto/i, 'Mark your numbers and shout when you win. There are cards on sale at the door and prizes for the lucky.'],
  [/Culinary|Fruit and vegetable carving|Fruit carving|ice carving|galley tour/i, 'Watch the chefs at work as they carve, plate and tell their kitchen secrets, with a few tastes to try.'],
  [/dance (?:class|lesson|workshop)|dance workshop|Line dancing|line dancing|cha-cha|Tango|salsa|waltz|\bswing\b|Foxtrot|\bLatin\b/i, 'A friendly lesson with a dance instructor, with no partner or experience required. You will be dancing before it ends.'],
  [/Ship orientation|Welcome aboard briefing|shore excursion (?:briefing|talk)/i, 'Get your bearings with the cruise staff: where to find things on board, how the week works and what to do ashore.'],
  [/Enrichment|Discovery at (?:Sea|SEA)|lecture|Destination port|Port destination|wildlife lecture|history talk|Guest speaker|ocean history/i, 'An illustrated talk from a guest lecturer about the sea, the wildlife or the ports ahead.'],
  [/Board games|bridge|mahjong|card games|Book Club/i, 'A friendly corner of the ship for games and good company. Everyone is welcome and tables are open.'],
  [/Family craft|Family crafts|origami|Arts and crafts|craft and trivia|craft and origami/i, 'A relaxed craft hour for all ages, with supplies on the table. Make something to take home.'],
  [/Putting|croquet|Lawn Court/i, 'Friendly competition on the green for a small prize, with clubs and balls provided.'],
  [/Panoramic observation|Scenic cruising|Scenic observation|quiet lounge|quiet reading|tea service/i, 'A quiet spot with wide views of the sea and coast. Bring a book or just enjoy the scenery.'],
  [/Pool Olympics|belly[- ]flop|Poolside Olympics|Poolside games/i, 'Silly, splashy games between crew and guests. Volunteer to play or enjoy the show from a lounger.'],
  [/scavenger hunt/i, 'Follow the clues around the ship to uncover its art and its secrets at your own pace.'],
  // Casino
  [/slot tournament|slots|spin-to-win/i, 'Play for a share of the prize pool in a friendly slot tournament. Register at the casino before the start.'],
  [/blackjack|baccarat|poker|Hold’em|craps|roulette|table games|high-limit/i, 'A table game for beginners and regulars alike, with dealers on hand to explain the rules. Play for fun or for a prize.'],
  [/Casino grand opening/i, 'The casino opens for the voyage, with free lessons so you can learn the games before you play.'],
  [/jackpot drawings|hot seat|cash drawings|ticket redemption|cash-out/i, 'Draw tickets and cash-out time at the casino, with prizes for the lucky and a warm welcome for all.'],
  // Fitness
  [/CycleBar/i, 'A high-energy ride on a studio bike to a driving playlist. All levels welcome, with a bike set up for you.'],
  [/Pure Barre/i, 'A low-impact, full-body workout at the barre, built on small movements that sculpt and strengthen.'],
  [/YogaSix|yoga|tai chi/i, 'A guided yoga or tai chi class to ease the body and settle the mind. Mats are provided.'],
  [/StretchLab/i, 'A guided session of assisted stretching to loosen tight muscles and ease out the kinks.'],
  [/Pilates/i, 'A low-impact class on the mat that builds core strength, posture and balance.'],
  [/Boot camp|Fab Abs|Walk-a-Mile|Sunset Walk|Farewell Walk/i, 'A group workout or walk with the fitness team, at your own pace and in good company.'],
  [/Morning stretch|Stretch and release|stretch and release|detox stretch|Sunrise stretch/i, 'A gentle stretch to wake the body up or wind it down. No experience needed.'],
  [/Zumba|dance and Zumba|Poolside dance/i, 'A dance-fitness party with easy steps and loud music. Join in wherever you are.'],
  [/basketball|pickleball|volleyball|soccer|shuffleboard|ping pong|sports match|court/i, 'Open play and friendly competition on the sports court. Equipment is provided, and anyone can join in.'],
  [/lap swimming/i, 'The pool is set aside for lap swimmers, with lanes marked and a lifeguard on duty.'],
  [/Fitness desk|gym tour|Foot and posture/i, 'Meet the fitness team, see what classes are on and sign up for the ones you like.'],
  // Shopping
  [/Boutiques open|boutiques open|Grand opening: all|Boutique preview/i, 'The ship’s boutiques open for the voyage, with welcome offers in every shop.'],
  [/fragrance|perfume/i, 'Try the new scents with the beauty advisers, with a spritz to take with you.'],
  [/giveaway|raffle|pendant gift/i, 'Enter the raffle and pick up a small welcome gift at the boutique.'],
  [/sale|sidewalk|clearance|blowout|markdown|Pop-up|pop-up|pop-up|\$\d+/i, 'A limited-time sale with bargains on watches, jewellery, accessories and gifts. The best finds go quickly.'],
  [/Inch of Gold/i, 'Pick a gold chain by the inch and have it cut to length on the spot.'],
  [/portrait|photo|canvas|Medallion keepsake|Digital and print|pick-up|framing|art settlement/i, 'Collect your photos and keepsakes, or settle your art purchases, before the voyage ends.'],
  [/auction|\bart\b/i, 'View the art on offer and bid if you wish, with champagne while you browse.'],
  [/watch|Rolex|TAG Heuer|Tissot|Horology|horology/i, 'Look at fine Swiss timepieces with the watch specialists, who will answer all your questions.'],
  [/diamond|gemstone|tanzanite|emerald|jewelry|jewellery|Effy|Swarovski|Brighton|bijoux/i, 'See sparkling jewellery and gemstones up close, and talk to the specialists about the pieces you like.'],
  [/skincare|beauty|Dior|Lancôme|Glow at Sea|makeover/i, 'A hands-on session with the beauty advisers, with samples to try and tips to take home.'],
  [/liquor|scotch|bourbon|spirits|chocolate|confectionery|tasting/i, 'A guided tasting of fine spirits, chocolate and treats from the duty-free shop. For adults only where spirits are poured.'],
  [/souvenir|apparel|resort wear|sunglass|logo|T-shirt|outerwear|handbag/i, 'Browse the ship’s souvenirs, fashion and gifts, with special prices for the day.'],
  // Spa and others
  [/(?:Wi-Fi|app) (?:clinic|setup)|MedallionNet|Tech desk|boarding pass printing/i, 'Get help with your Wi-Fi, your phone and the Princess app from the ship’s tech specialists.'],
  [/Harbor arrival|gangway/i, 'Watch the ship dock from the forward decks as the pilot comes aboard and the lines go ashore.'],
  [/stargazing/i, 'Look at the stars from the forward deck with a guide to show you the constellations. Weather permitting.'],
  [/Smartphone|photography/i, 'Learn to take better pictures on your phone from the ship’s photographers, with tips for light and composition.'],
  [/Disembarkation|customs/i, 'Find out how luggage, departure groups and customs work on the last morning so you can leave without a fuss.'],
  [/Captain and officers/i, 'Put your questions to the captain and senior officers about the ship and life at sea.'],
  [/watercolor|ukulele/i, 'A beginner-friendly class with the supplies provided. No experience needed.'],
  [/Choir at Sea/i, 'Join other guests to rehearse songs for a showcase later in the week. No audition is needed.'],
  [/Port and shopping/i, 'The shore excursions team shares maps, tips and the best local shops before you go ashore.'],
]

/** A sentence or two about an event from its title, or null when no rule knows it. */
export function eventCopy(title: string): string | null {
  for (const [re, text] of RULES) {
    const m = title.match(re)
    if (m) return typeof text === 'function' ? text(m) : text
  }
  return null
}
