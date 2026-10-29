/** The cabin TV (ENT-06): the channel guide, video on demand and the remote. Channels and titles are authored concept content. */
export interface Channel { n: number; name: string; shows: readonly string[] }

/** Each channel has a programme for each four-hour part of the day, starting at midnight. */
export const CHANNELS: readonly Channel[] = [
  { n: 1, name: 'Ship Information', shows: ['Captain’s channel', 'Port talk', 'Today on board', 'Port talk', 'Today on board', 'Captain’s channel'] },
  { n: 2, name: 'Bridge Cam', shows: ['Night bridge cam', 'Sunrise bridge cam', 'Bridge cam', 'Bridge cam', 'Sunset bridge cam', 'Night bridge cam'] },
  { n: 3, name: 'Princess Live', shows: ['Replay: welcome show', 'Morning stretch', 'Cooking demo', 'Trivia replay', 'Stage show replay', 'Comedy replay'] },
  { n: 4, name: 'Movies Under the Stars', shows: ['Classic film', 'Family film', 'Adventure film', 'Family film', 'Romance film', 'Thriller'] },
  { n: 5, name: 'Family', shows: ['Bedtime stories', 'Cartoons', 'Kids’ cooking', 'Cartoons', 'Family film', 'Bedtime stories'] },
  { n: 6, name: 'News', shows: ['World news', 'Morning news', 'Midday news', 'Business news', 'Evening news', 'World news'] },
  { n: 7, name: 'Sport', shows: ['Replays', 'Football', 'Tennis', 'Golf', 'Basketball', 'Highlights'] },
  { n: 8, name: 'Nature', shows: ['Ocean at night', 'Birds of the Caribbean', 'Coral reefs', 'Whales', 'Sunset sea', 'Ocean at night'] },
  { n: 9, name: 'Spa and Wellness', shows: ['Sleep meditation', 'Morning yoga', 'Stretching', 'Breathing', 'Evening yoga', 'Sleep meditation'] },
  { n: 10, name: 'Music', shows: ['Calm', 'Jazz', 'Pop', 'Latin', 'Soul', 'Calm'] },
  { n: 11, name: 'Port Guides', shows: ['Cozumel guide', 'Belize guide', 'Roatán guide', 'Cozumel guide', 'Belize guide', 'Roatán guide'] },
  { n: 12, name: 'On Demand', shows: ['Choose a title', 'Choose a title', 'Choose a title', 'Choose a title', 'Choose a title', 'Choose a title'] },
]

export const channelByNumber = (n: number): Channel | undefined => CHANNELS.find((c) => c.n === n)

/** What is on a channel at a ship-time hour, 0 to 23. */
export const onNow = (channel: Channel, hour: number): string => channel.shows[Math.min(5, Math.max(0, Math.floor(hour / 4)))]

export const VOD_CHANNEL = 12

export interface Title { id: string; name: string; minutes: number; rating: string }
export const VOD: readonly Title[] = [
  { id: 'v-reef', name: 'Life on the Reef', minutes: 52, rating: 'G' },
  { id: 'v-cook', name: 'The Galley: how a ship cooks', minutes: 38, rating: 'G' },
  { id: 'v-captain', name: 'Captain’s story', minutes: 44, rating: 'G' },
  { id: 'v-comedy', name: 'Comedy night, replay', minutes: 60, rating: 'PG-13' },
  { id: 'v-family', name: 'Family adventure', minutes: 96, rating: 'PG' },
  { id: 'v-drama', name: 'Harbour lights', minutes: 112, rating: 'PG-13' },
]
export const titleById = (id: unknown): Title | undefined => VOD.find((v) => v.id === id)

/** Whether a title is suitable for a guest: ratings above PG need an adult, and PG-13 needs 13. */
export const titleAllowed = (rating: string, age: number): boolean => rating === 'G' || (rating === 'PG' && age >= 8) || (rating === 'PG-13' && age >= 13)
