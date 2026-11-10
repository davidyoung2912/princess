import { useMemo } from 'react'
import type { AwayFacts } from '../ai/stanleyAway'
import { returnTimes } from '../domain/awayFromShip'
import { takeMeBackFor } from '../domain/portDelights'
import { PORT_KNOWLEDGE } from '../domain/portContent'
import { portById, shipZoneAt } from '../domain/sailings'
import { PORT_CONTACTS } from '../domain/services'
import { GUEST_SERVICES_NUMBER } from '../domain/contacts'
import { clockTime } from '../domain/syncAge'
import { useNow, useSailing } from './useDemo'
import { useAwayFromShip } from './useAwayFromShip'

/** What the on-device Stanley may say about this port day, or null while the guest is not away. Built only from what the app already holds. */
export function useAwayFacts(): AwayFacts | null {
  const { day, away } = useAwayFromShip()
  const sailing = useSailing()
  const now = useNow()
  const minute = Math.floor(now / 60_000)
  return useMemo(() => {
    if (!away || !day) return null
    const ship = (at: number) => clockTime(new Date(at), shipZoneAt(sailing, at))
    const times = returnTimes(day, minute * 60_000)
    const landing = times.find((x) => x.id === 'landing')!
    const k = PORT_KNOWLEDGE[day.port]
    const contacts = PORT_CONTACTS[day.port]
    const back = takeMeBackFor(day.port)
    const walk = k?.walks[0]
    const fare = k?.fairPrices[0]
    return {
      portName: portById(day.port)?.name.split(',')[0] ?? day.port,
      tender: day.tender,
      allAboard: ship(day.allAboardAt),
      gangwayBy: ship(landing.at),
      sails: ship(times.find((x) => x.id === 'sails')!.at),
      minutesLeft: Math.max(0, Math.ceil((day.allAboardAt - minute * 60_000) / 60_000)),
      shipPhone: GUEST_SERVICES_NUMBER,
      localEmergency: contacts?.emergency ?? null,
      agent: contacts?.agent ?? null,
      takeMeBack: { place: back.place, say: back.say, english: back.english },
      taxiStand: k?.taxiStand ?? null,
      fare: fare ? { route: fare.route, ceiling: fare.ceiling } : null,
      firstWalk: walk ? { name: walk.name, minutes: walk.minutes, sit: walk.sit, restroom: walk.restroom } : null,
      firstScam: k?.scams[0] ?? null,
      firstPhrase: k?.phrases[0] ? { say: k.phrases[0].say, means: k.phrases[0].means } : null,
    }
  }, [away, day, sailing, minute])
}
