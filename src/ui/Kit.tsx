import { useState } from 'react'
import { t, type StringKey } from '../i18n'
import { Banner } from './Banner'
import { Button, LinkButton } from './Button'
import { Card } from './Card'
import { Chip } from './Chip'
import { Dialog } from './Dialog'
import { ErrorSummary, Field } from './Field'
import { Stepper, type StepDef } from './Stepper'
import { StatusBadge, type BadgeKind } from './StatusBadge'
import { SyncChip } from './SyncChip'
import { Timeline, type TimelineItem } from './Timeline'

const BADGES: readonly BadgeKind[] = ['booked', 'waitlist', 'soldOut', 'changed', 'cancelled', 'ready']

/** A fixed moment for the sample chips, so the page reads the same every time. */
const SAMPLE_NOW = new Date('2027-03-21T14:00:00Z')
const SAMPLE_UPDATED = new Date('2027-03-21T13:14:00Z')

/** Every shared component in each of its states, for reviewing the design system. Not part of the guest experience. */
export function Kit() {
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState(true)
  const [accessible, setAccessible] = useState(false)
  const [free, setFree] = useState(false)
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const digits = phone.replace(/\D/g, '').length
  const error = submitted && digits < 10 ? t('kit.form.error') : undefined

  const steps: StepDef[] = [
    { id: 'guests', label: t('kit.step.guests'), state: 'done' },
    { id: 'passport', label: t('kit.step.passport'), state: 'done' },
    { id: 'photo', label: t('kit.step.photo'), state: 'current' },
    { id: 'payment', label: t('kit.step.payment'), state: 'todo' },
    { id: 'contract', label: t('kit.step.contract'), state: 'todo' },
  ]
  const items: TimelineItem[] = [
    { id: 'muster', time: '3:00 pm', title: t('kit.timeline.muster'), detail: t('kit.timeline.musterDetail') },
    { id: 'sail', time: '4:00 pm', title: t('kit.timeline.sail'), detail: t('kit.timeline.sailDetail') },
    { id: 'show', time: '8:30 pm', title: t('kit.timeline.show'), detail: t('kit.timeline.showDetail'), status: 'changed', change: t('kit.timeline.showChange') },
    { id: 'trivia', time: '9:30 pm', title: t('kit.timeline.trivia'), status: 'cancelled', change: t('kit.timeline.triviaChange') },
  ]

  return (
    <div className="page">
      <h1>{t('route.kit')}</h1>
      <p>{t('kit.intro')}</p>

      <section aria-labelledby="kit-type"><h2 id="kit-type">{t('kit.type')}</h2>
        <Card hero labelledBy="kit-type-sample">
          <h3 id="kit-type-sample">{t('kit.type.sample')}</h3>
          <p>{t('kit.type.body')}</p>
          <p>{t('kit.type.numbers')}</p>
        </Card>
      </section>

      <section aria-labelledby="kit-colour"><h2 id="kit-colour">{t('kit.colour')}</h2>
        <ul className="swatches">
          <li className="swatch swatch--primary">{t('kit.colour.primary')}</li>
          <li className="swatch swatch--warm">{t('kit.colour.surfaceWarm')}</li>
          <li className="swatch swatch--info">{t('kit.colour.surfaceInfo')}</li>
          <li className="swatch swatch--success">{t('kit.colour.success')}</li>
          <li className="swatch swatch--warning">{t('kit.colour.warning')}</li>
          <li className="swatch swatch--danger">{t('kit.colour.danger')}</li>
          <li className="swatch swatch--gold">{t('kit.colour.gold')}</li>
        </ul>
      </section>

      <section aria-labelledby="kit-buttons"><h2 id="kit-buttons">{t('kit.buttons')}</h2>
        <div className="stack">
          <Button>{t('kit.button.primary')}</Button>
          <Button variant="secondary">{t('kit.button.secondary')}</Button>
          <Button variant="tertiary">{t('kit.button.tertiary')}</Button>
          <Button variant="danger">{t('kit.button.danger')}</Button>
          <Button disabled aria-describedby="why-disabled">{t('kit.button.disabled')}</Button>
          <p id="why-disabled" className="muted">{t('kit.button.disabledWhy')}</p>
          <LinkButton to="/" variant="secondary">{t('kit.button.link')}</LinkButton>
        </div>
      </section>

      <section aria-labelledby="kit-banners"><h2 id="kit-banners">{t('kit.banners')}</h2>
        <div className="stack">
          <Banner kind="info" title={t('kit.banner.info')} />
          <Banner kind="success" title={t('kit.banner.success')} />
          <Banner kind="warning" title={t('kit.banner.warning')} />
          <Banner kind="danger" title={t('kit.banner.danger')} action={<Button variant="secondary">{t('kit.banner.action')}</Button>}>{t('kit.banner.dangerBody')}</Banner>
          <Banner kind="offline" title={t('kit.banner.offline')}>{t('kit.banner.offlineBody')}</Banner>
        </div>
      </section>

      <section aria-labelledby="kit-sync"><h2 id="kit-sync">{t('kit.sync')}</h2>
        <SyncChip updated={SAMPLE_UPDATED} now={SAMPLE_NOW} state="live" timeZone="America/New_York" />
        <SyncChip updated={SAMPLE_UPDATED} now={SAMPLE_NOW} state="offline" timeZone="America/New_York" />
      </section>

      <section aria-labelledby="kit-badges"><h2 id="kit-badges">{t('kit.badges')}</h2>
        <p className="row">{BADGES.map((kind) => <StatusBadge key={kind} kind={kind} label={t(`kit.badge.${kind}` as StringKey)} />)}</p>
      </section>

      <section aria-labelledby="kit-chips"><h2 id="kit-chips">{t('kit.chips')}</h2>
        <p className="row">
          <Chip pressed={kids} onToggle={() => setKids(!kids)}>{t('kit.chip.kids')}</Chip>
          <Chip pressed={accessible} onToggle={() => setAccessible(!accessible)}>{t('kit.chip.accessible')}</Chip>
          <Chip pressed={free} onToggle={() => setFree(!free)}>{t('kit.chip.free')}</Chip>
        </p>
      </section>

      <section aria-labelledby="kit-form"><h2 id="kit-form">{t('kit.form')}</h2>
        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }} noValidate>
          <ErrorSummary title={t('kit.form.summary')} errors={error ? [error] : []} />
          <Field label={t('kit.form.label')} hint={t('kit.form.hint')} error={error} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="submit">{t('kit.form.submit')}</Button>
          {submitted && !error && <p role="status">{t('kit.form.saved')}</p>}
        </form>
      </section>

      <section aria-labelledby="kit-stepper"><h2 id="kit-stepper">{t('kit.stepper')}</h2>
        <Stepper steps={steps} label={t('kit.stepper.label')} />
      </section>

      <section aria-labelledby="kit-timeline"><h2 id="kit-timeline">{t('kit.timeline')}</h2>
        <Timeline items={items} label={t('kit.timeline.label')} nowIndex={1} />
      </section>

      <section aria-labelledby="kit-cards"><h2 id="kit-cards">{t('kit.cards')}</h2>
        <Card><p>{t('kit.card.plain')}</p></Card>
        <Card hero><p>{t('kit.card.hero')}</p></Card>
        <Card info><p>{t('kit.card.info')}</p></Card>
      </section>

      <section aria-labelledby="kit-dialog"><h2 id="kit-dialog">{t('kit.dialog')}</h2>
        <Button variant="secondary" onClick={() => setOpen(true)}>{t('kit.dialog.open')}</Button>
        {open && <Dialog title={t('kit.dialog.title')} onClose={() => setOpen(false)}><p>{t('kit.dialog.body')}</p></Dialog>}
      </section>
    </div>
  )
}
