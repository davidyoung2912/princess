import type { LucideIcon } from 'lucide-react'
import {
  Anchor,
  ArrowRight,
  Backpack,
  Baby,
  Binoculars,
  BookOpen,
  BedDouble,
  Building2,
  Clock,
  Cloud,
  CloudSun,
  Compass,
  Cog,
  Coins,
  Eye,
  Flag,
  Footprints,
  Gauge,
  Globe,
  HeartPulse,
  Landmark,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  MapPin,
  Navigation,
  Plane,
  Radar,
  Route,
  Shirt,
  Ship,
  Smartphone,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Ticket,
  Users,
  Utensils,
  Waves,
  EyeOff,
  Wallet,
  UserRound,
  Umbrella,
  History,
  Theater,
  Wrench,
} from 'lucide-react'

/**
 * The icon a page-jump pill's title calls for: the first rule whose words match. Order matters, the specific before the general
 * (for example "What you'll need" must meet its rule before the general "what" rule). Plain TypeScript so it is tested without React.
 */
const RULES: readonly (readonly [RegExp, LucideIcon])[] = [
  // Stage welcome page
  [/welcome|aboard|how you got here/i, Anchor],
  [/what you.ll need|\bneed\b|\bbring\b/i, Backpack],
  [/how this prepares|what comes after|\bprepares\b/i, Route],
  [/your progress|\bprogress\b|steps in this stage/i, ListChecks],
  [/move on|how this stage ends/i, ArrowRight],
  [/what this stage is about|\babout\b|\boverview\b/i, Compass],
  // Day plan bundles
  [/\bmorning\b/i, Sunrise],
  [/\bafternoon\b/i, Sun],
  [/\bevening\b/i, Sunset],
  [/after your tour|\btour\b/i, Footprints],
  [/\bexplorers?\b/i, Binoculars],
  // Packing groups
  [/documents|money/i, Wallet],
  [/clothes|clothing/i, Shirt],
  [/shore days|beach/i, Umbrella],
  [/\bhealth\b|medical/i, HeartPulse],
  [/phones?|chargers?|\btech\b/i, Smartphone],
  [/children|teens|\bkids\b/i, Baby],
  [/added by you/i, UserRound],
  [/\bhid(den|e)\b|you hid/i, EyeOff],
  // Port and country guide titles that share words with later rules
  [/ports that call/i, MapPin],
  [/culture|fun facts/i, Theater],
  [/port facts|\bfacts?\b|at a glance/i, Globe],
  // Nautical page
  [/position|course|\bnavigation\b/i, Navigation],
  [/voyage|ports?\b/i, Route],
  [/clocks?|\btime\b/i, Clock],
  [/the sea|\bwaves?\b/i, Waves],
  [/the air|weather|\bsky\b/i, CloudSun],
  [/light of the day|daylight|\bsun(rise|set)?\b/i, Sun],
  [/\bnight\b|\bmoon\b/i, Moon],
  [/engines?|motion|machinery/i, Cog],
  [/the bridge|on the bridge/i, Gauge],
  [/other vessels|\bradar\b/i, Radar],
  [/around the ship/i, Binoculars],
  [/the ship|\bvessel\b|\bship\b|\bdeck\b/i, Ship],
  // Ship explorer
  [/on board/i, Ship],
  [/stateroom|\bcabins?\b|\brooms?\b|suites?\b/i, BedDouble],
  [/accessib/i, Users],
  [/dining|restaurants?|\bfood\b|\bbars?\b|eat/i, Utensils],
  [/theat(er|re)|show|entertain|arena/i, Theater],
  [/\bspa\b|wellness|sanctuary/i, Sparkles],
  [/piazza|atrium|\bdome\b|seawalk|\bwalk\b/i, Building2],
  // Port and country guides
  [/getting ashore|\bashore\b|\barrive\b|transport/i, Plane],
  [/things to do|\bactivit/i, Binoculars],
  [/traveller tips|\btips?\b/i, Lightbulb],
  [/\bhistory\b/i, History],
  [/government|society/i, Landmark],
  [/economy|currency|\bcost\b/i, Coins],
  [/people to know|\bpeople\b|\bgroup\b/i, Users],
  [/\bplaces?\b|\bwhere\b/i, MapPin],
  [/explore further|\blinks?\b|\bfurther\b/i, LinkIcon],
  // General
  [/\btickets?\b|\bbook/i, Ticket],
  [/\bcloud/i, Cloud],
  [/\bfix|\brepair|\bsettings\b/i, Wrench],
  [/\bread|\bguide\b|\blearn\b/i, BookOpen],
  [/\bsee\b|\bview\b|\blook\b/i, Eye],
  [/\bstatus\b|\bflag\b/i, Flag],
]

/** Pills whose id says more than their words: the stage welcome headings carry a next-stage name that could match another rule. */
const BY_ID: Readonly<Record<string, LucideIcon>> = {
  'welcome-before': Anchor,
  'welcome-focus': Compass,
  'welcome-need': Backpack,
  'welcome-lead': Route,
  'welcome-steps': ListChecks,
  'welcome-moveon': ArrowRight,
}

/** The icon for a pill: by its id when it has a fixed one, else by its words, else the compass (a pill is a way round the page). */
export function pillIcon(label: string, id?: string): LucideIcon {
  const fixed = id ? BY_ID[id] : undefined
  if (fixed) return fixed
  for (const [re, icon] of RULES) if (re.test(label)) return icon
  return Compass
}
