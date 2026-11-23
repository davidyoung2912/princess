/** One number or fact on the stats page. A `joke` stat is made up and the screen says so; a `route` is a screen's path, shown by that screen's title. */
export interface StatItem {
  id: string
  label: string
  value: string
  note: string | null
  joke: boolean
  route: string | null
}

/** A group of stats about one part of the app. A `joke` section holds nothing but made-up stats. */
export interface StatSection {
  id: string
  title: string
  blurb: string
  icon: string
  joke: boolean
  stats: StatItem[]
}

/** Everything the stats page shows. `highlights` are the ids of the stats worth leading with. */
export interface StatsReport {
  generatedAt: number
  name: string
  headline: string
  realCount: number
  jokeCount: number
  highlights: string[]
  sections: StatSection[]
}

/** Counters to add, by key: `opens`, `views`, `seconds`, `shares`, `route.<screen>`, `area.<tab>`, `hour.<00-23>`. */
export type StatsCounters = Record<string, number>

export interface StatsApi {
  report(): Promise<StatsReport>
  /** Adds what this device saw since the last report. `day` is yyyy-MM-dd on the device's clock. Never throws for the caller to handle: a lost report is simply lost. */
  track(day: string, counters: StatsCounters): Promise<void>
}
