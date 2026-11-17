/**
 * The word list behind Word Search: cruise and travel words of 3 to 10 letters, upper case. A puzzle prefers these words; common words from
 * the Codeword list fill the gaps. The hidden answers are cruise words too, one list per length.
 */
const THEMED = `
sea bay sun fun map pad tan oar fin ray
ship boat deck port dock wave tide surf sand beach reef cove isle gulf bays cape sail mast bow stern helm keel hull crew
cabin suite berth galley bridge anchor harbor harbour marina pier quay jetty ferry yacht liner cruise voyage sailor captain
island lagoon coral shore coast ocean tropic palm palms sunny breeze swell spray foam shell shells pearl dolphin whale turtle seal gull
seagull penguin pelican parrot lobster shrimp crab crabs fish tuna snapper
ticket passport luggage suitcase bag bags trunk tour tours guide trip trips travel trek hike hikes ride rides route map maps
buffet dinner lunch brunch snack cocktail drinks juice coffee tea cake pasta pizza salad steak sushi taco tacos fruit cheese bread
spa pool pools sauna massage yoga gym deck chair towel lotion shade swim swims splash slide lounge
show shows music dance dancing disco stage theatre cinema casino bingo trivia karaoke party parade band
sunset sunrise dawn dusk moon moonlit stars night starry cloud clouds rain storm wind windy calm gale
port starboard bow stern aft fore compass lifeboat lifejacket buoy rope knot flag lantern beacon lighthouse horizon
passage cruiser mariner voyager explorer nautical captain admiral anchorage dockside gangway promenade veranda balcony terrace
souvenir postcard camera photo photos snorkel diving dive kayak paddle sail sailing fishing fish zipline
bahamas cozumel nassau tender excursion shoreline seaside seashore waterfront paradise holiday vacation getaway
`

const split = (s: string): string[] => s.toUpperCase().split(/\s+/).filter(Boolean)

/** Themed words, upper case, no repeats, 3 to 10 letters. */
export const WORD_SEARCH_WORDS: readonly string[] = [...new Set(split(THEMED))].filter((w) => w.length >= 3 && w.length <= 10)

/** Hidden answers by length (5 to 8); the letters left uncovered at the end spell one of them. */
export const WORD_SEARCH_ANSWERS: Readonly<Record<number, readonly string[]>> = {
  5: ['OCEAN', 'CORAL', 'SWELL', 'SHORE', 'COAST', 'WAVES', 'DECKS', 'ISLES'],
  6: ['CABINS', 'HARBOR', 'VOYAGE', 'ISLAND', 'SAILOR', 'LAGOON', 'BREEZE', 'SUNSET', 'ANCHOR', 'TICKET'],
  7: ['HOLIDAY', 'CAPTAIN', 'SUNRISE', 'TROPICS', 'BALCONY', 'VOYAGER', 'SEAGULL', 'SEAFOOD', 'MASSAGE', 'GETAWAY'],
  8: ['PARADISE', 'SEASHORE', 'LIFEBOAT', 'SUNSHINE', 'SHIPMATE', 'SEAWATER', 'GANGWAYS'],
}
