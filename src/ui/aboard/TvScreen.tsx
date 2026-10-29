import { useState } from 'react'
import { CHANNELS, VOD, channelByNumber, onNow, titleAllowed } from '../../domain/tv'
import { api } from '../../runtime'
import type { TvState } from '../../api/aboardTypes'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSailing } from '../../hooks/useDemo'
import { shipZoneAt } from '../../domain/sailings'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { AboardError, Back, ChildNote } from './common'

/** The cabin TV (ENT-06): what is on, video on demand, a remote and casting from the phone. */
export function TvScreen() {
  const tv = useMine(() => api.aboard.tv.get())
  const me = usePersona()
  const now = useNow()
  const sailing = useSailing()
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: shipZoneAt(sailing, now) }).format(new Date(now)))
  const [device, setDevice] = useState('')
  const set = useAction(async (patch: Partial<TvState>) => { await api.aboard.tv.set(patch); tv.retry() })
  const locked = !!me?.child
  return (
    <div className="page">
      <h1>{t('route.tv')}</h1>
      <p>{t('tv.intro')}</p>
      <ChildNote />
      <AboardError error={set.error} />
      <Load state={tv}>
        {(s) => (
          <>
            <Card labelledBy="remote-h">
              <h2 id="remote-h" className="card__title">{t('tv.remote')}</h2>
              <p role="status">{s.on ? t('tv.nowOn', { n: s.channel, name: channelByNumber(s.channel)?.name ?? '', show: s.vod ? VOD.find((v) => v.id === s.vod)?.name ?? '' : onNow(channelByNumber(s.channel)!, hour) }) : t('tv.off')}{s.muted ? ` · ${t('tv.muted')}` : s.on ? ` · ${t('tv.volume', { volume: s.volume })}` : ''}</p>
              <div className="button-row">
                <Button variant={s.on ? 'secondary' : 'primary'} disabled={set.busy || locked} onClick={() => void set.run({ on: !s.on })}>{s.on ? t('tv.powerOff') : t('tv.powerOn')}</Button>
                <Button variant="secondary" disabled={set.busy || locked || !s.on || s.channel <= 1} onClick={() => void set.run({ channel: s.channel - 1, vod: null })}>{t('tv.chDown')}</Button>
                <Button variant="secondary" disabled={set.busy || locked || !s.on || s.channel >= CHANNELS.length} onClick={() => void set.run({ channel: s.channel + 1, vod: null })}>{t('tv.chUp')}</Button>
              </div>
              <div className="button-row">
                <Button variant="secondary" disabled={set.busy || locked || !s.on || s.volume <= 0} onClick={() => void set.run({ volume: Math.max(0, s.volume - 5), muted: false })}>{t('tv.volDown')}</Button>
                <Button variant="secondary" disabled={set.busy || locked || !s.on || s.volume >= 100} onClick={() => void set.run({ volume: Math.min(100, s.volume + 5), muted: false })}>{t('tv.volUp')}</Button>
                <Button variant="tertiary" aria-pressed={s.muted} disabled={set.busy || locked || !s.on} onClick={() => void set.run({ muted: !s.muted })}>{t('tv.mute')}</Button>
              </div>
              <p className="muted">{t('tv.cabinNote')}</p>
            </Card>

            <section aria-labelledby="guide-h">
              <h2 id="guide-h">{t('tv.guide')}</h2>
              <table className="tv-guide">
                <thead><tr><th scope="col">{t('tv.channel')}</th><th scope="col">{t('tv.onNow')}</th><th scope="col"><span className="visually-hidden">{t('tv.watch')}</span></th></tr></thead>
                <tbody>
                  {CHANNELS.map((c) => (
                    <tr key={c.n}>
                      <th scope="row">{c.n}. {c.name}</th>
                      <td>{onNow(c, hour)}</td>
                      <td><Button variant="tertiary" disabled={set.busy || locked} onClick={() => void set.run({ channel: c.n, on: true, vod: null })}>{t('tv.watch')}<span className="visually-hidden"> {c.name}</span></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section aria-labelledby="vod-h">
              <h2 id="vod-h">{t('tv.vod')}</h2>
              <ul className="card-grid">
                {VOD.map((v) => (
                  <li key={v.id}>
                    <Card>
                      <h3 className="card__title">{v.name}</h3>
                      <p className="muted">{t('tv.vodMeta', { minutes: v.minutes, rating: v.rating })}</p>
                      {titleAllowed(v.rating, me?.age ?? 0) ? <Button variant="secondary" disabled={set.busy || locked} onClick={() => void set.run({ vod: v.id })}>{t('tv.play')}</Button> : <p className="muted">{t('tv.tooYoung')}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="cast-h">
              <h2 id="cast-h">{t('tv.cast')}</h2>
              {s.casting ? (
                <Banner kind="success" title={t('tv.casting', { device: s.casting })} action={<Button variant="secondary" disabled={set.busy || locked} onClick={() => void set.run({ casting: null })}>{t('tv.stopCast')}</Button>}>
                  <p>{t('tv.castingBody')}</p>
                </Banner>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); void set.run({ casting: device.trim(), on: true }).then(() => setDevice('')) }}>
                  <Field label={t('tv.device')} hint={t('tv.deviceHint')} value={device} maxLength={40} onChange={(e) => setDevice(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={set.busy || locked || !device.trim()}>{t('tv.startCast')}</Button>
                </form>
              )}
            </section>
          </>
        )}
      </Load>
      <Back to="/ship/room" label={t('route.room')} />
    </div>
  )
}
