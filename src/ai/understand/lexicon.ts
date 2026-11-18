/**
 * The lexicon (docs/stanley-answers-plan.md, 5.5): the nouns, qualifiers and question acts a guest uses, each with its synonyms, informal words and common ways of saying it. It is data. Words are written as
 * people say them; the engine stems both sides, so "booking", "booked" and "books" need not all be listed. A phrase may be several words. A word may sit under more than one concept ("class").
 * `n.` is a thing, `q.` a qualifier (when, who) and `a.` what the guest wants to do (the acts at the end).
 */
export interface Concept { id: string; words: readonly string[] }

const c = (id: string, words: string): Concept => ({ id, words: words.split(',').map((w) => w.trim()).filter(Boolean) })

export const ACTS = ['LOST', 'PROBLEM', 'CANCEL', 'CHANGE', 'BOOK', 'ORDER', 'REMIND', 'PRICE', 'WHEN', 'FIND', 'ALLOWED', 'REQUIRE', 'COMPARE', 'RECOMMEND', 'STATUS', 'CONTACT', 'PLAN', 'LIST', 'WHAT_IS', 'HOW'] as const
export type Act = (typeof ACTS)[number]

export const CONCEPTS: readonly Concept[] = [
  // ---- eating and drinking ----
  c('n.restaurant', 'restaurant, eatery, place to eat, places to eat, somewhere to eat, dining room, bistro, cafe, grill, steakhouse, trattoria, diner, specialty, specialty restaurant, fine dining, sit down, sit-down, where to eat, venue, venues'),
  c('n.dinner', 'dinner, supper, evening meal, dine, dining, main dining, dinner time, tonights dinner, eat out, formal dinner'),
  c('n.lunch', 'lunch, brunch, midday meal, lunch time, lunchtime'),
  c('n.breakfast', 'breakfast, morning meal, brekkie, breakfast in bed'),
  c('n.meal', 'meal, meals, food, eat, eating, hungry, starving, snack, snacks, bite to eat, menu, menus, dish, dishes, cuisine, midnight snack, late night food, 24 hour food'),
  c('n.buffet', 'buffet, horizon court, self service, all you can eat'),
  c('n.casualfood', 'pizza, pizzeria, burger, burgers, hot dog, fries, taco, tacos, sandwich, sandwiches, salad, grab and go, snack bar, deli, bbq, sushi, steak, seafood, lobster, pasta, curry'),
  c('n.dessert', 'dessert, desserts, ice cream, gelato, cake, sweets, pastry, pastries, chocolate, cookie, cookies, treats'),
  c('n.table', 'table, tables, table for two, seat at dinner, seating, party of, a table'),
  c('n.reservation', 'my table, my tables, which tables, reservation, reservations, rsvp, time slot, appointment, spot'),
  c('n.dresscode', 'what do i wear, what should i wear, what can i wear, can i wear, wear to dinner, what do people wear, what do men wear, need a jacket, wear, dress code, formal night, formal nights, smart casual, attire, tuxedo, tux, gown, black tie, what to wear, jacket required, shorts allowed, elegant evening, dressy, dress up'),
  c('n.diet', 'vegetarian, vegan, gluten, gluten free, coeliac, celiac, halal, kosher, dairy free, lactose, nut free, keto, diet, dietary, plant based, pescatarian, low sodium, sugar free, diabetic, special diet'),
  c('n.allergy', 'allergy, allergies, allergic, allergen, allergens, peanut, shellfish, intolerance, cross contamination'),
  c('n.drink', 'drink, drinks, cocktail, cocktails, beer, wine, spirits, liquor, alcohol, soda, mocktail, mocktails, happy hour, bar tab, whiskey, vodka, rum, champagne, juice, water, bottled water, refill'),
  c('n.bar', 'piano bar, bar, bars, pub, lounge, nightclub, sports bar, wine bar, cocktail bar, tavern, rooftop bar, pool bar'),
  c('n.coffee', 'coffee, latte, cappuccino, espresso, barista, tea, coffee shop, iced coffee, decaf'),
  c('n.roomservice', 'bring to my cabin, bring to my room, sent up to my room, sent to my room, send up to my room, room service, cabin delivery, food to my cabin, food to my room, breakfast in bed, delivery to my room, order to my cabin, in cabin dining, in room dining, deliver to my cabin'),
  c('n.package', 'drinks package, drink package, beverage package, unlimited drinks, premier package, dining package, wifi package, package, packages, plus package, all inclusive, bundle, prepaid, prepay, pre pay, pre-paid'),
  c('n.cover', 'cover charge, surcharge, extra cost, specialty fee, upcharge, extra charge, supplement'),
  c('n.kidsmenu', 'kids menu, childrens menu, high chair, baby food, formula, bottle warmer, sippy cup'),
  // ---- shows, music and fun ----
  c('n.show', 'shows, show tonight, show times, show time, see a show, what show, which show, live show, performance, performances, production, musical, theater, broadway, cabaret, stage show, entertainment, magician, comedian, comedy, comedy club, act, acts, tickets for the show, theatre show, princess live'),
  c('n.movie', 'movie, movies, film, films, cinema, movies under the stars, poolside movie, outdoor movie, screen, screening'),
  c('n.music', 'music, band, live music, piano, piano bar, singer, concert, dj, dance, dancing, dance floor, disco, karaoke, jazz, orchestra, steel drums'),
  c('n.trivia', 'trivia, quiz, bingo, game show, contest, competition, tournament, deal or no deal, name that tune'),
  c('n.casino', 'casino, gambling, slots, slot machine, poker, blackjack, roulette, bet, betting, lottery, jackpot'),
  c('n.activity', 'activity, activities, things to do, something to do, bored, boredom, pastime, event, events, fun, entertain, what to do, keep busy, kill time, daily activities, what is there to do, what can we do, what can i do, anything to do, to do on'),
  c('n.pool', 'pool, pools, swim, swimming, lido, infinity pool, hot tub, jacuzzi, whirlpool, slide, water slide, waterslide, splash, water park, swim up bar, towels at the pool'),
  c('n.sports', 'basketball, volleyball, pickleball, tennis, minigolf, golf, putting, sports court, soccer, ping pong, table tennis, shuffleboard, climbing wall, rock climbing, zip line, ropes course, bowling, simulator, sports'),
  c('n.game', 'game, games, puzzle, puzzles, sudoku, crossword, wordle, jigsaw, brain teaser, challenge, challenges, ship challenge, scavenger hunt, nonogram, word search, kenken, kakuro, minesweeper'),
  c('n.library', 'library, reading, read a book, board games, deck of cards, card games, chess, backgammon, jigsaw puzzle'),
  c('n.workshop', 'class, classes, craft, crafts, arts and crafts, workshop, workshops, cooking class, wine tasting, tasting, lesson, lessons, seminar, lecture, lectures, enrichment, towel folding, napkin folding, art class, dance class, painting, scrapbooking, trivia class'),
  c('n.photo', 'photo, photos, photograph, photographer, portrait, picture, pictures, gallery, photo shop, professional photos, my photos, photo package, selfie'),
  c('n.sun', 'sun deck, sunbathe, sunbathing, tanning, lounger, loungers, deck chair, sunbed, shade, cabana, solarium, adults only deck, sit outside, find a seat by the pool, reserve a lounger'),
  c('n.view', 'view, views, scenery, sunset, sunrise, sailaway, stargazing, observation, whale watching, dolphins, wildlife, northern lights, glacier'),
  c('n.schedule', 'schedule, program, timetable, whats on, what is on, agenda, calendar, lineup, line up, daily, patter, princess patter, daily program, daily planner, opening hours'),
  // ---- spa and fitness ----
  c('n.spa', 'spa, spas, wellness, pamper, pampering, relax, relaxation, day spa, serenity, retreat, me time, unwind'),
  c('n.massage', 'massage, massages, rubdown, deep tissue, swedish, hot stone, back rub, masseuse, masseur, couples massage'),
  c('n.facial', 'facial, facials, skin care, skincare, manicure, pedicure, nails, nail, waxing, beauty, hair, haircut, salon, hairdresser, barber, blow dry, makeup, hairstyle, shave, eyebrow, lashes, hair color'),
  c('n.treatment', 'treatment, treatments, therapy, session, sauna, steam room, thermal suite, hydrotherapy, aromatherapy, acupuncture, teeth whitening, body wrap, scrub, detox, thermal spa, hydro pool'),
  c('n.gym', 'gym, fitness center, fitness, workout, exercise, treadmill, weights, cardio, run, running, jog, jogging, jogging track, track, yoga, pilates, spin, spinning, bootcamp, aerobics, zumba, stretch, personal trainer, fitness class, exercise class, stairs workout, walk the deck, step count'),
  // ---- shops ----
  c('n.shop', 'where can i buy, where to buy, do you sell, for sale, swimsuit, swimwear, bathing suit, bikini, shop, shops, shopping, store, stores, boutique, boutiques, dutyfree, souvenir, souvenirs, gift, gifts, gift shop, jewelry, watch, watches, perfume, cologne, handbag, buy something, merchandise, merch, logo, t shirt, shirt, hat, sale, discount shop'),
  c('n.sundries', 'headache, painkillers, ibuprofen, toothbrush, toothpaste, shampoo, razor, deodorant, sunscreen, sunblock, sun cream, aspirin, band aid, bandaid, tampons, contact lens solution, essentials, sundries, toiletries, pharmacy, convenience store, forgot my'),
  // ---- the ship and the cabin ----
  c('n.deck', 'deck, decks, floor, level, upstairs, downstairs, stairs, staircase, stairwell, which floor, forward, aft, midship, mid ship, port side, starboard'),
  c('n.map', 'map, maps, deck plan, deck plans, layout, floor plan, find my way, navigate, navigation, directions, ship map, interactive map, wayfinding'),
  c('n.elevator', 'elevator, elevators, escalator'),
  c('n.place', 'atrium, piazza, lobby, plaza, main hall, theater, theatre, sanctuary, observation deck, promenade, library, internet cafe, conference room, planetarium, art gallery, art auction, bridge, helipad'),
  c('n.guestservices', 'guest services, front desk, reception, purser, information desk, customer service, guest relations, help desk, service desk, concierge'),
  c('n.chapel', 'pray, renew our vows, renew vows, vows, chapel, church, worship, mass, interfaith, prayer, prayers, religious, shabbat, synagogue, mosque, bible, vow renewal, wedding at sea, wedding'),
  c('n.laundry', 'wash, clothes washed, get my clothes washed, laundry, laundromat, washing machine, wash clothes, wash my clothes, dry clean, dry cleaning, iron, ironing, ironing board, press, launder, washer, dryer, detergent, laundry bag, laundry service, wrinkled'),
  c('n.wifi', 'wifi, internet, signal, network, web, hotspot, internet access, internet package, wifi package, streaming, video call, no wifi, wifi password, connect to the wifi, wifi not working, log on, medallion net'),
  c('n.phone', 'roaming charges, roaming fees, data roaming, phone, cell, cell phone, cellphone, call, calls, text, texting, sms, roaming, sim, international plan, phone plan, whatsapp, ship to shore, call home, phone home, call my family, calling card, airplane mode'),
  c('n.charger', 'charge my phone, charge my device, charge my devices, charge my, charger, plug, outlet, outlets, socket, sockets, adapter, adaptor, voltage, usb, power strip, extension cord, converter, hair dryer, hairdryer, power bank, battery, power'),
  c('n.tv', 'tv, television, channel, channels, cable, stream, netflix, on demand, cabin tv, tv channels, movies in my room, in room entertainment, remote'),
  c('n.cabin', 'cabin, stateroom, room, suite, balcony, veranda, oceanview, ocean view, inside cabin, interior, mini suite, my room, my cabin, bed, beds, bunk, bathroom, shower, toilet, fridge, mini fridge, minibar, thermostat, air conditioning, noise, noisy, loud, do not disturb, dnd, cabin key, cabin number, which cabin am i in, cabin door'),
  c('n.amenity', 'towel, towels, pillow, pillows, blanket, blankets, ice, extra bed, toiletries, hangers, bottle opener, coffee maker, kettle, crib, cot, bathrobe, robe, slippers, bedding, sheets, linen, extra towel, extra pillow, more towels, shampoo refill, toilet paper, bath mat, fan, humidifier, night light'),
  c('n.steward', 'cabin steward, steward, housekeeping, housekeeper, maid, cleaning, clean my room, make up room, turndown, turn down service, service my room, room attendant'),
  c('n.safe', 'safe, cabin safe, lockbox, lock box, valuables, safe code, safe not working, passport in safe'),
  c('n.kidsclub', 'kids club, kids club hours, camp, youth program, youth club, babysitting, nursery, childcare, kids activities, kids program, teen club, teens, drop off, drop the kids, kids area, splash zone, playroom, child care'),
  // ---- ports and shore ----
  c('n.port', 'port, ports, destination, destinations, stop, stops, ashore, go ashore, on land, shore, land, island, islands, town, city, harbor, dock, pier, docking, gangway, port day, port days, port of call, ports of call, port information, port guide, port stop'),
  c('n.onboard', 'on board, onboard, aboard, on the ship, on the boat, on this ship, on the cruise, on a cruise'),
  c('n.seaday', 'sea day, sea days, at sea, days at sea, day at sea'),
  c('n.excursion', 'excursion, excursions, tour, tours, shore excursion, shore excursions, shore trip, trip, trips, guided tour, sightseeing, snorkel, snorkeling, scuba, dive, diving, zipline, catamaran, kayak, beach day, beach, beaches, ruins, mayan, dolphin, swim with dolphins, bus tour, cave, jungle, hike, hiking, waterfall, rum tasting, tequila tasting, city tour, walking tour, boat tour, sightsee, what to do in port, things to do in port, port activities, private tour, tour guide, book a tour'),
  c('n.tender', 'tender, tenders, tender boat, tendering, tender ticket, tender port, anchor, anchored, shuttle boat'),
  c('n.allaboard', 'need to be back, be back, time to be back, all aboard, allaboard, back on the ship, back on board, last call, ship leaves, departure time, sail time, sailing time, what time do we leave, leave port, when does the ship leave, curfew, be back by, back by, get back to the ship, return to the ship'),
  c('n.missedship', 'missed the ship, miss the ship, ship left, ship left without me, stranded, late back, cannot get back to the ship, running late, late for the ship, ship sailed'),
  c('n.currency', 'currency, exchange, exchange rate, cash, dollars, pesos, atm, us dollars, euro, euros, local money, local currency, change money, money exchange, small bills, coins'),
  c('n.language', 'language, translate, translation, phrases, say hello, speak spanish, speak english, what language, useful words, local words, interpreter'),
  c('n.taxi', 'taxi, taxis, uber, cab, ride, transfer, shuttle, bus, rental car, car hire, transport, transportation, getting around, public transport, walk, walking, distance, how far, how far is it, get to town, get into town, golf cart, water taxi, ferry'),
  c('n.weather', 'weather, forecast, rain, raining, sunny, hot, cold, temperature, humid, storm, storms, hurricane, wind, windy, umbrella, what to wear in port, how hot, how cold, climate, forecast for port, rainy season'),
  c('n.seas', 'rough seas, choppy, waves, swell, motion, rocking, rocky, bumpy, sea conditions, stabilizers, how rough, will it be rough, sea state, high seas'),
  c('n.nextport', 'next port, next stop, next destination, next island, port tomorrow, the next one'),
  c('n.itinerary', 'which islands, what islands, islands do we visit, which countries, what countries, where does the ship stop, where do we stop, where are we stopping, itinerary, route, ports of call, where are we going, where does the ship go, where are we stopping, what ports, which ports, destinations list, our route, voyage plan, cruise route, stops on the cruise, port order, ports list, ports on this cruise'),
  // ---- travel and paperwork ----
  c('n.checkin', 'checkin, online checkin, web checkin, prepare to sail, pre boarding, preboarding, complete checkin, check in online, check in opens, check in window, ready to sail, express checkin, terminal checkin, health questionnaire, arrival time slot, choose arrival time, arrival appointment'),
  c('n.boardingpass', 'boarding pass, boarding passes, ticket, tickets, eticket, qr code, boarding document, sea pass, seapass, cruise ticket, boarding card, booking pass, print my boarding pass, show my pass'),
  c('n.medallion', 'medallion, ocean medallion, wearable, key card, cruise card, room key, id card, onboard card, ship card, access card, card to open door, keycard, cabin card, ship id'),
  c('n.embark', 'embark, embarkation, embarkation day, boarding, board the ship, boarding time, boarding group, arrival time, arrive at the port, arrival window, getting on the ship, boarding day, first day, sail day, embarkation day, terminal, cruise terminal, curbside, luggage drop, get on the ship'),
  c('n.muster', 'muster, muster drill, safety drill, safety briefing, lifejacket, life jacket, assembly station, muster station, lifeboat, lifeboats, emergency drill, safety video'),
  c('n.document', 'passport, passports, visa, visas, id, identification, drivers license, license, birth certificate, documents, document, paperwork, travel documents, citizenship, nationality, global entry, entry requirements, travel authorization, esta, expired passport, name on passport, name change, documents needed, what do i need to bring'),
  c('n.disembark', 'leave the cabin, out of the cabin, leave my cabin, cabin exit, exit the cabin, get out of my cabin, disembark, disembarkation, leave the ship, getting off, get off, debark, debarkation, last day, final day, checkout, check out, exit time, vacate, vacate cabin, bags out, self assist, walk off, off the ship, leaving the ship, final morning, day of departure, departure day, end of cruise, end of the cruise, last morning'),
  c('n.luggage', 'bags off the ship, bags off the boat, get my bags off, put my bags out, put bags out, leave my bags, leave bags, luggage, bags, baggage, suitcase, suitcases, carry on, bag tags, luggage tags, tags, porter, lost luggage, missing bag, bag, bags out, leave bags outside, luggage tag, bag drop, bag pickup, retrieve bags, baggage claim'),
  c('n.flight', 'flight, flights, airport, airline, airplane, fly, arrive the day before, day before, night before, stay the night before, flying, layover, arrive early, hotel before, pre cruise hotel, post cruise hotel, parking, park my car, port parking, shuttle to port, getting to the port, getting home, ride to the airport, onward travel, flight home, flight delay, delayed flight, flight time, what time should i book my flight'),
  c('n.customs', 'bring things home, bring things back, customs, immigration, declaration, declare, border, quarantine, import, duty free allowance, allowance, bring back, bring home, what can i bring back, customs form, entry rules, entry requirements, visa on arrival'),
  c('n.packing', 'bring my own, bring my own wine, bring wine, bring alcohol, own wine, own alcohol, own drinks, what can i not bring, what cannot i bring, cannot bring, can not bring, what should i bring, what do i bring, what to bring on a cruise, bring on a cruise, packing, pack, packing list, what to bring, what to pack, luggage allowed, allowed items, prohibited, forbidden, restricted items, banned items, bring alcohol, bring wine, bring a kettle, bring an iron, not allowed, items allowed, packing tips, what should i pack, must haves'),
  // ---- money ----
  c('n.bill', 'bill, folio, statement, account, balance, charges, charge, charged, onboard account, tab, ship account, receipt, receipts, invoice, itemized, what do i owe, spent, spending, how much have i spent, how much do i owe, final bill, charge on my bill, wrong charge, extra charge, double charged, onboard spending, running total'),
  c('n.price', 'price, prices, cost, costs, fee, fees, fare, rate, expensive, cheap, discount, deal, deals, offer, offers, promotion, how much, pricing, free, included, complimentary, extra, worth the money, no charge, budget, affordable, per person, per night, how much does it cost'),
  c('n.tip', 'tip, tips, tipping, gratuity, gratuities, service charge, service charges, discretionary, auto gratuity, automatic tip, daily gratuity, tip the crew, tip the steward'),
  c('n.credit', 'onboard credit, obc, ship credit, future cruise credit, fcc, credit, credits, voucher, gift card, cruise credit, shipboard credit, credit balance, use my credit, spend my credit'),
  c('n.payment', 'pay the rest, pay the remainder, rest of the payment, remaining balance, payment, payments, credit card, debit card, card on file, add a card, change card, change my card, refund, refunded, deposit, final payment, balance due, installment, installments, payment method, pay my balance, pay the balance, price drop, money back, paid in full, payment due, due date, payment plan'),
  c('n.loyalty', 'my status, what is my status, loyalty, captains circle, captain circle, elite, perks, points, tier, member, membership, rewards, past guest, repeat guest, loyalty number, loyalty benefits, loyalty points'),
  c('n.insurance', 'travel protection, cruise protection, insurance, travel insurance, cancel for any reason, coverage, protection plan, cruise insurance, trip protection, medical insurance'),
  // ---- planning and booking ----
  c('n.trip', 'my trip, my trips, my booking, my voyage, reservation number, booking number, confirmation, confirmation number, booking reference, upcoming cruise, my sailing, my cruise details, booking details, booking confirmation'),
  c('n.newbooking', 'new booking, start a booking, start booking, make a booking, make a new booking, book now'),
  c('n.cruise', 'vacation, vacations, cruise, cruises, voyage, voyages, sailing, sailings, cruise deals, find a cruise, search cruises, new cruise, next cruise, book a cruise, book a cruise vacation, cruise options'),
  c('n.ship', 'ship, ships, vessel, boat, sun princess, ship size, ship comparison, class of ship, fleet, newest ship, biggest ship, which ship, about the ship, ship features, ship facts, how big is the ship, how many passengers'),
  c('n.region', 'caribbean, alaska, mediterranean, europe, hawaii, mexico, bahamas, panama canal, australia, asia, norway, fjords, baltic, british isles, canada, new england, south pacific, transatlantic, world cruise, japan, bermuda, greece, italy, spain, alaska cruise, caribbean cruise, europe cruise, where to go, where should i go, which destination'),
  c('n.besttime', 'best time to go, best time to cruise, when to go, which month, when should i cruise, when is the best time, best month, best season'),
  c('n.month', 'january, february, march, april, may, june, july, august, september, october, november, december, summer, winter, spring, fall, autumn, christmas, new year, spring break, school vacation, school holidays, when to go, off season, peak season, high season, low season, shoulder season, cruise in'),
  c('n.cabinchoice', 'quietest, quietest cabin, balcony worth, balcony cabin worth, worth the extra, extra for a balcony, balcony or inside, cabin worth, cabin category, cabin type, cabin types, which cabin, best cabin, cabin location, quiet cabin, obstructed view, connecting cabins, cabin comparison, cabin choice, choose a cabin, pick a cabin, cabin size, cabin layout, what cabin should i book, balcony or inside, inside or balcony, suite upgrade, upgrade, upgrades, bid for upgrade, cabin upgrade, cabin differences, interior vs balcony, which deck is best, where should my cabin be'),
  c('n.compare', 'compare, comparison, versus, vs, difference between, better than, which is better, side by side, how do they differ, what is the difference'),
  c('n.saved', 'saved, shortlist, favorites, wishlist, save for later, bookmarks, my saved, saved sailings, saved cruises, my favorites, my shortlist'),
  c('n.decide', 'which cruise to pick, which cruise to choose, which cruise to book, pick a cruise, choose a cruise, help me pick, decide, decision, help me choose, which cruise, recommend a cruise, best cruise for me, quiz, advisor, travel agent, cruise advisor, not sure which, help me pick, cannot decide, need advice, cruise quiz, first cruise, first time cruiser, never cruised'),
  c('n.family', 'family, kids, children, child, toddler, baby, infant, teen, teenager, teens, grandkids, grandchildren, multigenerational, family friendly, under 12, young children, with kids, my son, my daughter, my kids, for the kids'),
  c('n.group', 'together, decide together, vote on, help us decide, as a group, group, friends, party, wedding party, reunion, bachelorette, bachelor party, everyone, all of us, our group, split, poll, vote, plan with friends, travel companions, my friends, big group, family group, group booking, share the plan, ask everyone, decide together'),
  c('n.solo', 'on their own, by themselves, on your own, for one person, someone alone, solo, alone, by myself, single traveler, traveling alone, on my own, meet people, solo traveler, single, travel solo, solo cruiser, make friends'),
  // ---- the app and the guest ----
  c('n.chat', 'chat, message, messages, messaging, dm, connect, meet, find people, meet people, people on board, friend request, friend requests, roommates, community, chat rooms, text a guest, text another guest, message another guest, another guest, other guests, fellow guests, fellow passengers, other passengers, another passenger, text someone, talk to other guests, message a guest, chat with'),
  c('n.settings', 'settings, preferences, change my language, app language, change language, language setting, bigger text, larger text, make the text bigger, text bigger, bigger font, larger font, font bigger, text too small, make text larger, notifications, notification, push, sound, text size, font size, dark mode, theme, profile, password, sign in, log in, login, log out, my details, my profile, change my name, change my email, change my password, display'),
  c('n.privacy', 'privacy, data, what data, share data, delete my data, gdpr, personal information, consent, permissions, my data, who can see, data protection, erase my data, export my data'),
  c('n.reminder', 'reminder, reminders, alarm, wake up call, wakeup call, remind, my reminders, alerts, notify, alert, nudge'),
  c('n.help', 'support, assist, assistance, feedback, report, customer care, how does this app work, how do i use, app help, tutorial, user guide, instructions, faq, guide'),
  c('n.contact', 'contact, contact number, phone number, call guest services, speak to someone, talk to someone, speak to a person, human, representative, agent, customer service number, emergency number, reach someone, get in touch, who do i call, hotline'),
  c('n.lostitem', 'wallet, keys, glasses, sunglasses, jacket, camera, ring, earring, necklace, bracelet, purse, backpack, shoes, laptop, tablet, item, belongings, stuff, lost and found, lost item, lost property'),
  c('n.access', 'wheelchair, mobility, accessible, accessibility, disabled, disability, scooter, walker, hearing, deaf, blind, visually impaired, sensory, autism, service animal, service dog, special assistance, handicap, ramp, oxygen, cpap, limited mobility, mobility aid, hearing loop, braille, assistance with walking, wheelchair accessible'),
  c('n.health', 'health, medical, medical center, medical centre, infirmary, nurse, clinic, medicine, medication, pharmacy, prescription, vaccine, vaccination, covid, illness, sick, unwell, injury, injured, wellness check, first aid, health form, pregnant, pregnancy'),
  c('n.pet', 'pet, pets, dog, cat, emotional support, service animal, kennel, animal'),
  c('n.today', 'what is happening, what is going on, what is happening today, whats happening today, whats next, what is next, what now, upcoming, today plan, what is on today'),
  c('n.plan', 'my plan, my schedule, my day, my week, plan my day, plan our day, plan the day, schedule my day, plan my evening, plan an evening, plan tonight, plan tomorrow, plan the evening, daily plan, what i have planned, my activities, what have i booked, what did i book'),
  c('n.complaint', 'complaint, complain, complained, unhappy, disappointed, not happy, terrible service, bad service, poor service, rude, unacceptable, want to complain, file a complaint'),
  c('n.survey', 'survey, review, rate my cruise, rating, how was, complaint, compliment, feedback form, comment, comments, suggestion box, tell princess'),
  c('n.sustain', 'protect the ocean, protect the environment, protect the sea, ocean, marine, wildlife protection, sustainability, environment, eco, recycling, green, emissions, carbon, shore power, plastic, waste'),
  // ---- qualifiers ----
  c('q.tonight', 'tonight, this evening, tonite, later today, later tonight'),
  c('q.tomorrow', 'tomorrow, next day, the day after, day after tomorrow'),
  c('q.today', 'today, right now, currently, at the moment, this morning, this afternoon, now'),
  c('q.kids', 'kids, children, child, toddler, baby, teen, young'),
  c('q.cheap', 'cheap, cheapest, budget, affordable, free, inexpensive, low cost, save money'),
  // ---- acts: what the guest wants to do ----
  c('a.FIND', 'where, find, cannot find, can not find, locate, location, located, directions, get to, getting to, which deck, what deck, how do i get to, way to, nearest, closest, near, how to find, where can i, where do i, where is, where are, where to, where should'),
  c('a.WHEN', 'when, what time, hours, open, opening, close, closing, closes, opens, until, times, how late, how early, start, starts, begin, begins, finish, ends, available, availability, what days, which days, schedule for, when does, when is, when are, time of, at what time'),
  c('a.BOOK', 'book, reserve, sign up, signup, sign me up, secure, grab, get me, i want, i would like, i would love, arrange, set up, buy, purchase, register, enroll, make an appointment, make a reservation, put me down, can i get, i need a, add to my plan, add to cart, can i book, how do i book, i want to book, i would like to book, get tickets, get a table, save me a seat, hold a spot, join, attend'),
  c('a.CHANGE', 'change, move, swap, switch, reschedule, modify, edit, update, different time, earlier time, later time, instead, replace, amend, rebook, shift'),
  c('a.CANCEL', 'cancel, drop, remove, withdraw, undo, no longer want, do not want, delete, call off, get rid of, take off, back out, pull out, give up my'),
  c('a.PRICE', 'how much, cost, costs, price, pricing, fee, charge, expensive, free, included, what does it cost, extra, pay for, complimentary, no charge, how expensive, is there a fee, is there a charge, is it free, is it included, worth the money, per person, how much is, how much are, how much does'),
  c('a.ORDER', 'order, send up, deliver, delivery, bring me, i need more, can i have, request, need some, send me, i need extra, extra, need another, could i get, can you send, can you bring'),
  c('a.WHAT_IS', 'what is, what are, explain, mean, meaning, tell me about, what does, define, information, details, learn about, what exactly, info about, more about, about, what do you know about, whats'),
  c('a.LIST', 'show my, show our, show us, what is there, options, choices, show me, what is on, list, browse, see, look at, view, explore, types of, kinds of, ideas, suggestions, ideas for, what are the, what are my options, what can i, what is available, what do you have, show all, everything'),
  c('a.RECOMMEND', 'best, good, great, recommend, recommended, suggest, worth, should i, favorite, popular, top, must do, must see, which is better, is it good, any good, nice, worth it, top rated, highly rated, any recommendations, what do you recommend, what is good, what should i try, you recommend'),
  c('a.ALLOWED', 'can i, may i, am i allowed, are we allowed, is it allowed, allowed, permit, permitted, ok to, okay to, is it okay, can we, banned, prohibited, forbidden, rules, policy, policies, restrictions, do they allow, are they allowed, is it permitted, can i bring, can we bring'),
  c('a.REQUIRE', 'do i need, need to, required, requirement, requirements, must, have to, prepare, needed, what do i need, do we need, is it required, mandatory, compulsory, needed for'),
  c('a.COMPARE', 'compare, comparison, versus, vs, difference, differences, better than, which is better, side by side, differ'),
  c('a.STATUS', 'is it open, is it working, update, delayed, delay, status, any news, still running, closed, is it closed, is it still, open now, any changes, has it changed, what changed, anything new'),
  c('a.LOST', 'lost, lose, missing, misplaced, left behind, forgot, forgotten, stolen, went missing, i lost, i left, left my, left it, i forgot, never got, did not get, never received, not received, did not receive, have not received, has not arrived, not arrived'),
  c('a.PROBLEM', 'not working, broken, broke, stuck, locked, locked out, cannot, problem, trouble, wrong, error, fail, failed, complaint, complain, damaged, cannot find, doesnt work, does not work, will not work, unable, missed, mistake, wrong charge, cannot get, cannot log in, cannot sign in, cannot open, cannot access, issue, issues, not right, not connecting, will not connect, will not load, does not load'),
  c('a.CONTACT', 'call, speak to, talk to, talk with, contact, reach, get in touch, phone number, email, human, person, agent, representative, who do i call, who can i ask, customer service, speak with'),
  c('a.REMIND', 'remind, reminder, do not let me forget, do not forget, alert me, notify me, alarm, wake me, wake up call, let me know, tell me when, ping me, nudge me, set a reminder'),
  c('a.PLAN', 'plan, planning, what should we do, what should i do, organize, spend the day, how should i spend, schedule my day, plan my day, make a plan, itinerary for, agenda, ideas for the day, plan our day, help me plan, plan my evening, plan an evening, how do i spend'),
  c('a.HOW', 'how, how do i, how can i, how to, how does, steps, process, instructions, guide me, walk me through, show me how, how do we, how can we, how would i'),
]

/** Words that are ordinary English or question furniture. They are never "corrected", never count as evidence, and are dropped before phrases are matched. */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  ('the a an my our your their his her its some any this that these those there here it i me we you they he she him them us and or but if so then than too very just really actually kindly please also still yet already even only ' +
   'to of in on at for with from by into onto about over under up down out off as be am is are was were been being do does did done have has had having will would could should shall might may can must ' +
   'not no never what which who whom whose why one two three four five six seven eight nine ten again always often ever much many more most less least few lot lots bit little big small new old long short next last first second ' +
   'good bad well okay yes yeah hello hi hey thanks thank stanley need want like get got go going let make take give tell say said know think see look ask help use try put keep come came ' +
   'time day days week night morning evening afternoon way thing things people person place something anything everything nothing someone anyone everyone ' +
   'can cannot cant dont doesnt didnt wont isnt arent wasnt around back away after before during while until since because when where how ' +
   'am pm hour hours minute minutes today tomorrow tonight yesterday now soon later early late each every other another such own same both either neither').split(' '),
)

/** Words that clutter a question without changing it, dropped before phrase matching (the determiners and fillers). */
export const DROP_WORDS: ReadonlySet<string> = new Set('the a an some any this that these those please just really actually kindly'.split(' '))

/** Words a typo may never be turned into: the words the safety screen reads, so a slip of the finger cannot create an emergency or a medical question. */
export const NEVER_WORDS: ReadonlySet<string> = new Set(
  'fire smoke overboard drown choke choking bleed bleeding overdose seizure collapse collapsed assault attack stroke heart unconscious breath breathe doctor medic medication prescription pregnant infection rash fever vomit norovirus covid seasick lawyer attorney sue lawsuit liability'.split(' '),
)

/** Common ordinary English words that are not in the lexicon but must never be altered by the typo corrector. */
export const COMMON_WORDS: readonly string[] = (
  'have want need make made take took give gave know think look find found tell told call called feel felt leave left keep kept begin began seem help show hear play run move live believe bring happen write provide sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain ' +
  'about above across after again against all almost alone along already also although always among another any anyone anything around because become before behind below between both cause could course different during each early either enough even every example fact family father few from general give going great group hand hard head hear high home house however important inside instead interest large later least less might money month more morning mother much must name never next night nothing number often once only order other otherwise outside over part party perhaps place point possible power present problem program question quite rather real really right room same second several should since small something sometimes still story such sure system take than that their them then there these they thing think those though thought through together under until upon usual very want water week where whether which while whole will within without women word work world would year young ' +
  'sorry thanks thank hello please maybe okay yeah yes cheers tell more happy sad angry nice good bad best worst better worse easy hard fast slow quick quickly tiny huge several many fine fair clean dirty empty full quiet loud busy free open closed ready late early soon today tonight tomorrow yesterday weekend weekday monday tuesday wednesday thursday friday saturday sunday ' +
  'ocean sea beach island sand shell sail sailing captain crew sailor anchor bridge wave harbor dock cruise cruising voyage princess ' +
  'tasty yummy delicious spicy sweet salty sour tasty cold warm hot cool rainy cloudy foggy lovely beautiful pretty gorgeous amazing awesome wonderful perfect terrible awful horrible fantastic excellent ' +
  'someone anyone everyone nobody somebody anybody everybody somewhere anywhere everywhere nowhere whatever whenever wherever whoever however whichever ' +
  'because since while although though unless until whether either neither besides therefore moreover furthermore meanwhile otherwise nevertheless nonetheless ' +
  'joke funny laugh story song poem sing dance news sport game score team match result price weather' ).split(' ')
