import { useState, type FormEvent } from 'react'
import type { Reservation } from '../../api/types'
import { formatMoney } from '../../domain/pricing'
import { MAX_TABLE, splitEvenly } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { AboardError } from './common'

/** Friends at the table and a fair split of the bill (DIN-09). Friends are named with their cabin; the split adds up to the table's charge exactly. */
export function GroupTable({ r, canEdit }: { r: Reservation; canEdit: boolean }) {
  const table = useMine(() => api.aboard.groups.get(r.id), [r.id])
  const [name, setName] = useState('')
  const [cabin, setCabin] = useState('')
  const add = useAction(async () => { await api.aboard.groups.addFriend(r.id, { name, cabin }, r.guests.length); setName(''); setCabin(''); table.retry() })
  const remove = useAction(async (i: number) => { await api.aboard.groups.removeFriend(r.id, i); table.retry() })
  const split = useAction(async (mode: 'mine' | 'even') => { await api.aboard.groups.setSplit(r.id, mode); table.retry() })
  return (
    <section aria-labelledby="group-h">
      <h2 id="group-h">{t('group.title')}</h2>
      <p>{t('group.intro', { max: MAX_TABLE })}</p>
      <Load state={table}>
        {(g) => {
          const people = r.guests.length + g.friends.length
          const shares = splitEvenly(r.charge, people)
          return (
            <>
              {g.friends.length > 0 && (
                <ul className="plain-bullets">
                  {g.friends.map((f, i) => (
                    <li key={`${f.cabin}-${f.name}`}>{t('group.friend', { name: f.name, cabin: f.cabin })} {canEdit && <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(i)}>{t('group.remove')}<span className="visually-hidden"> {f.name}</span></Button>}</li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <form onSubmit={(e: FormEvent) => { e.preventDefault(); void add.run() }}>
                  <Field label={t('group.name')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                  <Field label={t('group.cabin')} inputMode="numeric" value={cabin} maxLength={5} onChange={(e) => setCabin(e.target.value)} />
                  <AboardError error={add.error ?? remove.error ?? split.error} />
                  <Button type="submit" variant="secondary" disabled={add.busy || !name.trim() || !cabin.trim()}>{t('group.add')}</Button>
                </form>
              )}
              <Card>
                <h3 className="card__title">{t('group.split')}</h3>
                {r.charge === 0 ? <p>{t('group.nothing')}</p> : (
                  <>
                    <div className="chip-row" role="group" aria-label={t('group.split')}>
                      <label className="choice"><input type="radio" name="split" checked={g.split === 'mine'} disabled={!canEdit} onChange={() => void split.run('mine')} /><span>{t('group.mine')}</span></label>
                      <label className="choice"><input type="radio" name="split" checked={g.split === 'even'} disabled={!canEdit} onChange={() => void split.run('even')} /><span>{t('group.even', { count: people })}</span></label>
                    </div>
                    {g.split === 'even' ? (
                      <p role="status">{t('group.each', { each: formatMoney(shares[shares.length - 1]), first: formatMoney(shares[0]), count: people })}</p>
                    ) : <p role="status">{t('group.youPay', { total: formatMoney(r.charge) })}</p>}
                    <p className="muted">{t('group.note')}</p>
                  </>
                )}
              </Card>
            </>
          )
        }}
      </Load>
    </section>
  )
}
