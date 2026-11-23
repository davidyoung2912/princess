import { useState } from 'react'
import type { SampleTrip } from '../../../shared/api/types'
import { useAction } from '../../../shared/hooks/useAction'
import { useMine } from '../../../shared/hooks/useMine'
import { t, th } from '../../../shared/i18n'
import { api, loadContext } from '../../../app/runtime'
import { ActionError } from '../../account/ui/parts'
import { Card } from '../../../shared/ui/Card'
import { Chip } from '../../../shared/ui/Chip'

/**
 * Before a guest has booked, the Explorers need a trip to describe. This asks them to pick a sample itinerary (one each for Sun, Sky and Sapphire Princess) to use until they book;
 * once they have a booking the server says it is not active and the card is gone.
 */
export function SampleTripCard() {
  const stored = useMine(() => api.sampleTrip.get())
  const [shown, setShown] = useState<SampleTrip | null>(null)
  const current = shown ?? stored.data
  const choose = useAction(async (sailingId: string) => {
    setShown(await api.sampleTrip.choose(sailingId))
    loadContext()   // the sailing the screens draw follows the sample
  })
  if (!current?.active || current.options.length === 0) return null
  return (
    <Card labelledBy="sample-trip-h">
      <h2 id="sample-trip-h">{th('sampleTrip.title')}</h2>
      <p>{t('sampleTrip.body')}</p>
      <div className="chip-row" role="group" aria-labelledby="sample-trip-h">
        {current.options.map((o) => (
          <Chip key={o.sailingId} pressed={o.sailingId === current.sailingId} onToggle={() => void choose.run(o.sailingId)}>{o.shipName}</Chip>
        ))}
      </div>
      <ActionError error={choose.error} />
      <p className="app-welcome__hint">{t('sampleTrip.hint')}</p>
    </Card>
  )
}
